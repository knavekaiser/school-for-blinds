const vendorModel = new Schema(
  {
    name: { type: String, required: true, trim: true },
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
  },
  { timestamps: true, discriminatorKey: "type" }
);

global.Vendor = mongoose.model("Vendor", vendorModel);

global.Doctor = Vendor.discriminator(
  "Doctor",
  new Schema({
    speciality: { type: String, required: true },
    education: { type: String, required: true },
    chambers: [
      {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zip: { type: Number },
        charge: { type: Number },
        available: [
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
    clinic: [{ type: String }],
    bookings: [
      {
        book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
      },
    ],
    gender: { type: String },
  })
);
global.Clinic = Vendor.discriminator(
  "Clinic",
  new Schema({
    bookings: [
      {
        book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
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
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookModel);
global.Book = Book;

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
