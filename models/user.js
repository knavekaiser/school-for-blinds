const userModel = new Schema({
  name: { type: String, trim: true },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  twitterId: { type: String, unique: true, sparse: true },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: Number },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  phone: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
  },
  email: { type: String, unique: true, sparse: true },
  pass: { type: String },
  gender: { type: String },
  age: { type: Number },
  appointments: [{ type: Schema.Types.ObjectId, ref: "Book", required: true }],
  status: { type: String, default: "basic" },
  medicalRecords: {
    nextVisit: {
      vendor: { type: Schema.Types.ObjectId, ref: "Vendor" },
      date: { type: Date },
      appointmentBooked: { type: Boolean, default: false },
    },
    prescriptions: [{ type: Schema.Types.ObjectId, ref: "Prescription" }],
    reports: [{ type: String }],
    otherData: [{ type: String }],
  },
  active: { type: Boolean, default: true },
  notifications: [
    new Schema(
      {
        title: { type: String, required: true },
        body: { type: String, required: true },
        link: { type: String },
      },
      { timestamps: true }
    ),
  ],
});
userModel.statics.updateAppointments = (_id) => {
  if (!ObjectId.isValid(_id)) return;
  return Book.find({ user: _id }, "_id").then((allBookings) =>
    User.findByIdAndUpdate(_id, {
      appointments: allBookings.map((item) => item._id),
    })
  );
};
userModel.statics.updatePrescription = (_id) => {
  if (!ObjectId.isValid(_id)) return;
  return Prescription.find({ user: _id }).then((prescriptions) => {
    User.findByIdAndUpdate(_id, {
      "medicalRecords.prescriptions": prescriptions.map((item) => item._id),
    }).then((dbRes) => {});
  });
};

global.User = mongoose.model("User", userModel);

const notificationSubscriptionModel = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Vendors" },
    endpoint: { type: String },
    keys: {
      auth: { type: String },
      p256dh: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

global.NotificationSubscription = mongoose.model(
  "NotificationSubscription",
  notificationSubscriptionModel
);
