app.post(
  "/api/addPrescription",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    const { vendor, user, date, img, medicines } = req.body;
    new Prescription({
      vendor,
      user,
      date,
      img,
      medicines,
    })
      .save()
      .then((dbRes) => {
        res.json({ message: "prescription saved" });
        User.updatePrescription(dbRes.user);
      })
      .catch((err) => {
        console.log(err);
        res.json({ message: "something went wrong" });
      });
  }
);
app.patch(
  "/api/updatePrescription",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Prescription.findByIdAndUpdate(req.body._id, { ...req.body })
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
  passport.authenticate("asstPrivate"),
  (req, res) => {
    Prescription.findOneAndDelete({ _id: req.body._id })
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
app.get(
  "/api/getPrescriptions",
  passport.authenticate("asstPrivate"),
  (req, res) => {
    const { vendor, user, date, page, perPage } = req.query;
    const query = {
      ...(vendor && { vendor: ObjectId(vendor) }),
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
        res.json(dbRes);
      })
      .catch((err) => {
        console.log(err);
        res.json({ message: "something went wrong" });
      });
  }
);
