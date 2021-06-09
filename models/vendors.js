const doctorModel = new Schema(
  {
    name: { type: String, required: true, trim: true },
    speciality: { type: String, required: true },
    clinic: { type: String },
    rating: {
      totalRating: { type: Number, default: 0 },
      reviews: [
        {
          rating: { type: Number, required: true },
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          body: { type: String },
        },
      ],
    },
    onlineBooking: { type: Boolean, default: true },
    pricing: { type: Number },
    phoneNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: { type: String, unique: true, sparse: true },
    bookings: [
      {
        book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
      },
    ],
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
    about: { type: String },
  },
  { timestamps: true }
);

const Doctor = mongoose.model("Doctor", doctorModel);
global.Doctor = Doctor;

const bookModel = new Schema(
  {
    vendor: { type: Schema.Types.ObjectId, ref: "DoctorModel", required: true },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    time: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookModel);
global.Book = Book;
