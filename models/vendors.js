const vendorModel = new Schema(
  {
    name: { type: String, required: true, trim: true },
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    twitterId: { type: String, unique: true, sparse: true },
    profileImg: { type: String },
    rating: {
      totalRating: { type: Number, default: 0 },
      reviews: [
        {
          rating: { type: Number, required: true },
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          feedback: { type: String },
        },
      ],
    },
    about: { type: String },
    onlineBooking: { type: Boolean, default: true },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: { type: String, unique: true, sparse: true },
    pass: { type: String },
    keywords: [{ type: String }],
    bookings: [{ type: Schema.Types.ObjectId, ref: "Book", required: true }],
    assistants: [{ type: Schema.Types.ObjectId, ref: "" }],
    available: { type: Boolean, default: true },
    speciality: [{ type: String, required: true }],
  },
  { timestamps: true, discriminatorKey: "type" }
);
vendorModel.statics.updateBooking = (_id) => {
  if (!ObjectID.isValid(_id)) return;
  return Book.find({ vendor: _id }, "_id").then((allBookings) =>
    Vendor.findByIdAndUpdate(_id, {
      bookings: allBookings.map((item) => item._id),
    })
  );
};
vendorModel.statics.addFeedback = ({ vendor, rating, feedback, user }) => {
  return Vendor.findById(vendor).then((vendor) => {
    const newFeedbacks = [...vendor.rating.reviews, { rating, user, feedback }];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length;
    return Vendor.findByIdAndUpdate(vendor._id, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};

global.Vendor = mongoose.model("Vendor", vendorModel);

global.Doctor = Vendor.discriminator(
  "Doctor",
  new Schema({
    age: { type: Number, required: true },
    gender: { type: String },
    education: {
      type: String,
    },
    chambers: [
      {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zip: { type: Number },
        charge: { type: Number },
        open: [
          {
            from: { type: Date, required: true },
            to: { type: Date, required: true },
          },
        ],
        sessionLength: { type: Number },
        location: {
          type: {
            type: String,
            enum: ["point"],
          },
          coordinates: {
            type: [Number],
          },
        },
      },
    ],
    clinic: [{ type: Schema.Types.ObjectId, ref: "Clinic", required: true }],
    gender: { type: String },
  })
);
global.Clinic = Vendor.discriminator(
  "Clinic",
  new Schema({
    doctors: [
      {
        type: Schema.Types.ObjectId,
        ref: "Doctor",
        required: true,
      },
    ],
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: Number },
      charge: { type: Number },
      location: {
        type: {
          type: String,
          enum: ["point"],
        },
        coordinates: {
          type: [Number],
        },
      },
      open: [
        {
          from: { type: Date, required: true },
          to: { type: Date, required: true },
        },
      ],
    },
  })
);

const bookModel = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    date: { type: Date, required: true },
    sessionLength: { type: Number },
    charge: { type: Number },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: Number },
      location: {
        type: {
          type: String,
          enum: ["point"],
        },
        coordinates: {
          type: [Number],
        },
      },
    },
    completed: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookModel);
global.Book = Book;

const prescirptionModel = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    img: { type: String },
    date: { type: Date, default: Date.now },
    medicines: [
      {
        name: { type: String },
        brand: { type: String },
        timeLine: {
          from: { type: Date },
          to: { type: Date },
        },
        timesToTake: [
          {
            type: String,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

const Prescription = mongoose.model("Prescription", prescirptionModel);

const blogModel = new Schema(
  {
    title: { type: String },
    author: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    topic: { type: String },
    keywords: [{ type: String }],
    body: { type: String },
  },
  { timestamps: true }
);

const Blog = mongoose.model("Blog", blogModel);
global.Blog = Blog;

const assistantModel = new Schema({
  name: { type: String, required: true },
  canApproveAppointments: { type: Boolean, default: false },
});
global.Assistant = mongoose.model("Assistant", assistantModel);

const specialityModel = new Schema({
  name: { type: String, required: true },
  symptoms: { tpye: String },
});

const Speciality = mongoose.model("Speciality", specialityModel);

const vendorLoginOTPModel = new Schema(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expireAt: { type: Date, default: Date.now, index: { expires: "2m" } },
    attempt: { type: Number, default: 0 },
  },
  { timestamp: true }
);

global.LoginOTP = mongoose.model("VendorLoginOTP", vendorLoginOTPModel);
