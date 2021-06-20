app.post(
  "/api/addProduct",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const { name, brand, price } = req.body;
    if (name && brand && price) {
      new Product({
        ...req.body,
        vendor: req.user._id,
      })
        .save()
        .then((dbRes) => {
          res.json({ message: "product added" });
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ message: "something went wrong" });
        });
    } else {
      res.status(400).json({ message: "incomplete request" });
    }
  }
);
app.patch(
  "/api/editProduct",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Product.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        res.json({ message: "product updated" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get("/api/findProducts", (req, res) => {
  const {
    name,
    brand,
    price,
    sort,
    order,
    perPage,
    page,
    category,
  } = req.query;
  const sortOrder = {
    [sort || "popularity"]: order === "asc" ? 1 : -1,
  };
  const query = {
    ...(name && { name: new RegExp(name, "gi") }),
    ...(brand && { brand: new RegExp(brand, "gi") }),
    ...(price && {
      price: { $gt: +price.split("-")[0], $lt: +price.split("-")[1] },
    }),
    ...(category && { category }),
  };
  Product.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "sales",
        localField: "sales",
        foreignField: "_id",
        as: "sales",
      },
    },
    {
      $lookup: {
        from: "vendors",
        localField: "vendor",
        foreignField: "_id",
        as: "vendor",
      },
    },
    {
      $set: {
        vendor: {
          $first: "$vendor",
        },
        popularity: {
          $reduce: {
            input: "$sales",
            initialValue: {
              total: 0,
            },
            in: {
              total: {
                $add: ["$$value.total", "$$this.qty"],
              },
            },
          },
        },
      },
    },
    {
      $set: {
        popularity: "$popularity.total",
      },
    },
    {
      $project: {
        "vendor.pass": 0,
        "vendor.chambers": 0,
        "vendor.chat": 0,
        "vendor.teleConsult": 0,
        "vendor.assistants": 0,
        "vendor.__v": 0,
        __v: 0,
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        products: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ])
    .then((products) => {
      res.json(products);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/checkProductAvailability", (req, res) => {
  Product.findOne({ _id: req.query._id })
    .then((product) => {
      if (product) {
        res.json({ available: product.available });
      } else {
        res.json({ available: 0 });
      }
    })
    .catch((err) => {
      res.status(500).json({ message: "something went wrong" });
    });
});
app.post(
  "/api/placeOrder",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const {
      products,
      vendor,
      total,
      discount,
      prescriptions,
      address,
    } = req.body;
    new Order({
      ...req.body,
      customer: req.user._id,
    })
      .save()
      .then((order) => {
        if (order) {
          res.json("order has been placed");
          order.products.forEach(async (item) => {
            await Product.findById(item.product).then((dbProduct) =>
              Product.findByIdAndUpdate(dbProduct._id, {
                available: dbProduct.available - item.qty,
              })
            );
          });
        } else {
          res.status(500).json({ message: "something went wrong" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/cancelOrderAsVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      {
        _id: req.body._id,
        delivered: false,
        vendor: req.user._id,
        cancelled: false,
      },
      { cancelled: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "order cancelled" });
          dbRes.products.forEach(async ({ product, qty }) => {
            await Product.findById(product).then((product) =>
              Product.findByIdAndUpdate(product._id, {
                available: product.available + qty,
              })
            );
          });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
);
app.patch(
  "/api/cancelOrderAsAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      {
        _id: req.body._id,
        delivered: false,
        vendor: req.user.vendor,
        cancelled: false,
      },
      { cancelled: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "order cancelled" });
          dbRes.products.forEach(async ({ product, qty }) => {
            await Product.findById(product).then((product) =>
              Product.findByIdAndUpdate(product._id, {
                available: product.available + qty,
              })
            );
          });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
);

app.get(
  "/api/getOrdersVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    const {
      sort,
      order,
      page,
      perPage,
      paid,
      approved,
      shipped,
      delivered,
      within,
    } = req.query;
    const query = {
      vendor: req.user._id,
      ...(within && {
        "customer.address.shipping.location": {
          $geoWithin: {
            $geometry: {
              type: "Polygon",
              coordinates: within,
            },
          },
        },
      }),
      ...(paid && { paid: paid === "true" }),
      ...(approved && { paid: approved === "true" }),
      ...(shipped && { paid: shipped === "true" }),
      ...(delivered && { paid: delivered === "true" }),
      ...(cancelled && { cancelled: cancelled === "true" }),
    };
    const sortOrder = {
      [sort || "age"]: order === "asc" ? 1 : -1,
    };
    Order.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "string",
        },
      },
      { $sort: sortOrder },
      {
        $facet: {
          orders: [
            { $skip: +perPage * (+(page || 1) - 1) },
            { $limit: +(perPage || 20) },
          ],
          pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
        },
      },
    ])
      .then((orders) => {
        res.json({ orders });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get(
  "/api/getOrdersAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    const {
      sort,
      order,
      page,
      perPage,
      paid,
      approved,
      shipped,
      delivered,
      within,
    } = req.query;
    const query = {
      vendor: req.user.vendor,
      ...(within && {
        "customer.address.shipping.location": {
          $geoWithin: {
            $geometry: {
              type: "Polygon",
              coordinates: within,
            },
          },
        },
      }),
      ...(paid && { paid: paid === "true" }),
      ...(approved && { paid: approved === "true" }),
      ...(shipped && { paid: shipped === "true" }),
      ...(delivered && { paid: delivered === "true" }),
      ...(cancelled && { cancelled: cancelled === "true" }),
    };
    const sortOrder = {
      [sort || "age"]: order === "asc" ? 1 : -1,
    };
    Order.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "string",
        },
      },
      { $sort: sortOrder },
      {
        $facet: {
          orders: [
            { $skip: +perPage * (+(page || 1) - 1) },
            { $limit: +(perPage || 20) },
          ],
          pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
        },
      },
    ])
      .then((orders) => {
        res.json({ orders });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.post(
  "/api/payForOrder",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { amount, paymentMethod, order } = req.body;
    // users give all their payment info in the request body.
    // payment api gets called with those detail.
    // return status code 200 and a transaction id in case
    // of a successful transaction
    if (200) {
      new PaymentLedger({
        type: "collection",
        user: req.user._id,
        amount,
        paymentMethod,
        note: "store payment", // specific for this route
        transactionId: "4154205121054105120", // from payment gateway
        product: order,
      })
        .save()
        .then((dbRes) => {
          if (dbRes) {
            return Order.findOneAndUpdate({ _id: order }, { paid: true });
          } else {
            return null;
          }
        })
        .then((update) => {
          if (update) {
            res.json({ message: "payment successful" });
          } else {
            res.status(400).json({ message: "something went wrong" });
          }
        })
        .catch((err) => {
          if (err.code === 11000) {
            res.status(400).json({
              message: "transaction id found in the database",
              code: err.code,
              field: Object.keys(err.keyValue)[0],
            });
          } else {
            console.log(err);
            res.status(500).json({ message: "something went wrong" });
          }
        });
    } else {
      // send different error based on the payment gateway error
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

app.patch(
  "/api/approveOrderVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id, paid: true },
      { approved: true }
    )
      .then((dbRes) => {
        res.json({ message: "order approved" });
        // send mail or sms to dbRes.customer.email/phone
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/approveOrderAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user.vendor, paid: true },
      { approved: true }
    )
      .then((dbRes) => {
        res.json({ message: "order approved" });
        // send mail or sms to dbRes.customer.email/phone
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/updateOrderVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "order updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/updateOrderAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user.vendor },
      { ...req.body }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "order updated" });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);

app.patch(
  "/api/orderDeliveredVendor",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      {
        _id: req.body._id,
        vendor: req.user._id,
        approved: true,
        cancelled: false,
        delivered: false,
        shipped: true,
      },
      { delivered: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "successfully updated" });
          notify(
            dbRes.customer,
            JSON.stringify({
              title: "Your product has been delivered",
              body: "Click here to review your experience.",
            })
          );
          dbRes.products.forEach(async ({ product, qty }) => {
            await new Sale({ product, qty }).save();
          });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/orderDeliveredAsst",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Order.findOneAndUpdate(
      {
        _id: req.body._id,
        vendor: req.user.vendor,
        approved: true,
        cancelled: false,
        delivered: false,
        shipped: true,
      },
      { delivered: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({ message: "successfully updated" });
          notify(
            dbRes.customer,
            JSON.stringify({
              title: "Your product has been delivered",
              body: "Click here to review your experience.",
            })
          );
          dbRes.products.forEach(async ({ product, qty }) => {
            await new Sale({ product, qty }).save();
          });
        } else {
          res.status(400).json({ message: "bad request" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
