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
        res.json(dbRes[0]);
      })
      .catch((err) => {
        console.log(err);
        res.json({ message: "something went wrong" });
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
            res.json({ message: "prescription added" });
          } else {
            res.status(400).json({ message: "bad request" });
          }
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
  "/api/updatePrescription",
  passport.authenticate("userPrivate"),
  (req, res) => {
    Prescription.findOneAndUpdate(
      { _id: req.body._id, user: req.user._id },
      { ...req.body }
    )
      .then((dbRes) => {
        res.json({ message: "prescription updated" });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "something went wrong" });
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
          res.json({ message: "prescription deleted" });
          User.updatePrescription(dbRes.user);
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
