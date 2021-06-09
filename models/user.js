const userModel = new Schema({
  name: { type: String, required: true, trim: true },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  twitterId: { type: String, unique: true, sparse: true },
  address: { type: String },
  phone: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
  },
  email: { type: String, unique: true, sparse: true },
  pass: { type: String },
  location: {
    type: {
      type: String,
      enum: ["point"],
    },
    coordinates: {
      type: [Number],
    },
  },
  gender: { type: String },
  appointments: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
});

global.User = mongoose.model("User", userModel);
