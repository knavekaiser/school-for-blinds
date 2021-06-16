app.post(
  "/api/addMedicine",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    new Medicine({
      ...req.body,
      vendor: req.user._id,
    })
      .save()
      .then((dbRes) => {
        res.json({ message: "medicine added" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.post(
  "/api/editMedicine",
  passport.authenticate("vendorPrivate"),
  (req, res) => {
    Medicine.findOneAndUpdate(
      { _id: req.body._id, vendor: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        res.json({ message: "medicine updated" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
      });
  }
);
app.get("/api/findMedicine", (req, res) => {
  const { name, brand, price, sort, order, perPage, page } = req.query;
  const sortOrder = {
    [sort || "popularity"]: order === "asc" ? 1 : -1,
  };
  const query = {
    ...(name && { name: new RegExp(name, "gi") }),
    ...(brand && { brand: new RegExp(brand, "gi") }),
    ...(price && {
      price: { $gt: +price.split("-")[0], $lt: +price.split("-")[1] },
    }),
  };
  Medicine.aggregate([
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
      $project: {
        popularity: {
          $reduce: {
            input: "$sales",
            initialValue: { total: 0 },
            in: {
              total: { $add: ["$$value.total", "$$this.qty"] },
            },
          },
        },
        name: 1,
        available: 1,
        brand: 1,
        price: 1,
        createdAt: 1,
        updatedAt: 1,
        prescriptionRequired: 1,
        dscr: 1,
        discount: 1,
      },
    },
    {
      $set: {
        popularity: "$popularity.total",
      },
    },
    { $sort: sortOrder },
    {
      $facet: {
        medicines: [
          { $skip: +perPage * (+(page || 1) - 1) },
          { $limit: +(perPage || 20) },
        ],
        pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
      },
    },
  ])
    .then((medicines) => {
      res.json(medicines);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "something went wrong" });
    });
});
app.get("/api/checkMedicineAvailability", (req, res) => {
  Medicine.findOne({ _id: req.query._id })
    .then((medicine) => {
      if (medicine) {
        res.json({ available: medicine.available });
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
      customer,
      prescriptions,
    } = req.body;
    new Order({
      vendor,
      products,
      total,
      discount,
      customer,
      prescriptions,
    })
      .save()
      .then((order) => {
        if (order) {
          res.json("order has been placed");
          order.products.forEach(async (item) => {
            await Medicine.findById(item.product).then((dbProduct) =>
              Medicine.findByIdAndUpdate(dbProduct._id, {
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
            await Medicine.findById(product).then((medicine) =>
              Medicine.findByIdAndUpdate(medicine._id, {
                available: medicine.available + qty,
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
            await Medicine.findById(product).then((medicine) =>
              Medicine.findByIdAndUpdate(medicine._id, {
                available: medicine.available + qty,
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
          from: "medicines",
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
          from: "medicines",
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
