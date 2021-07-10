app.get(
  "/api/getPrescriptions",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { user, date, page, perPage } = req.query;
    const query = {
      ...(user && { user: ObjectId(user) }),
    };
    Prescription.aggregate([
      { $match: query },
      {
        $facet: {
          prescriptions: [
            { $skip: +perPage * (+(page || 1) - 1) },
            { $limit: +(perPage || 20) },
          ],
          pageInfo: [{ $group: { _id: null, count: { $sum: 1 } } }],
        },
      },
    ])
      .then((dbRes) => {
        res.json({ code: "ok", ...dbRes[0] });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);
app.post(
  "/api/addPrescriptionUser",
  passport.authenticate("userPrivate"),
  (req, res) => {
    const { img } = req.body;
    if (img) {
      new Prescription({ ...req.body, user: req.user._id })
        .save()
        .then((dbRes) => {
          if (dbRes) {
            res.json({
              code: "ok",
              message: "prescription added",
              prescription: dbRes,
            });
          } else {
            res.status(500).json({ code: "ok", message: "database error" });
          }
        })
        .catch((err) => {
          console.log(err);
          res.status(500).json({ code: 500, message: "database error" });
        });
    } else {
      res.status(400).json({ code: 400, message: "img is required" });
    }
  }
);
app.patch(
  "/api/updatePrescription",
  passport.authenticate("userPrivate"),
  (req, res) => {
    if (!req.body._id) {
      res
        .status(400)
        .json({ code: 400, message: "prescription _id is required" });
      return;
    }
    Prescription.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id },
      { ...req.body },
      { new: true }
    )
      .then((dbRes) => {
        if (dbRes) {
          res.json({
            code: "ok",
            message: "prescription updated",
            prescription: dbRes,
          });
        } else {
          res
            .status(404)
            .json({ code: 404, message: "prescription could not be found" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "something went wrong" });
      });
  }
);
app.delete(
  "/api/deletePrescription",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Prescription.findOneAndDelete({ _id: req.body._id, user: req.user._id })
      .then((dbRes) => {
        if (dbRes) {
          res.json({ code: "ok", message: "prescription deleted" });
          User.updatePrescription(dbRes.user);
        } else {
          res
            .status(404)
            .json({ code: 404, message: "prescription could not be found" });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ code: 500, message: "database error" });
      });
  }
);
