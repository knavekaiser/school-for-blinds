const userModel = new Schema({
  name: { type: String, required: true, trim: true },
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
  appointments: [{ type: Schema.Types.ObjectId, ref: "Book", required: true }],
  status: { type: String, default: "basic" },
});
userModel.statics.updateAppointments = (_id) => {
  if (!ObjectId.isValid(_id)) return;
  return Book.find({ user: _id }, "_id").then((allBookings) =>
    User.findByIdAndUpdate(_id, {
      appointments: allBookings.map((item) => item._id),
    })
  );
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
