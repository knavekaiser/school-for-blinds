const medicineModel = new Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String },
    dscr: { type: String },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    prescriptionRequired: { type: Boolean, default: false },
    available: { type: Number, default: 0 },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      dscr: { type: String },
    },
    sales: [
      {
        type: Schema.Types.ObjectId,
        ref: "Sale",
      },
    ],
    images: [{ type: String }],
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
  },
  { timestamps: true }
);
medicineModel.statics.updateSale = (_id, sale_id) => {
  return Sales.find({ product: _id }, "_id").then((sales) =>
    Medicine.findByIdAndUpdate(_id, { sales: sales.map((sale) => sale._id) })
  );
};
medicineModel.statics.addFeedback = ({ _id, rating, feedback, user }) => {
  return Medicine.findById(_id).then((medicine) => {
    const newFeedbacks = [
      ...medicine.rating.reviews,
      { rating, user, feedback },
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length;
    return Medicine.findByIdAndUpdate(medicine._id, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};

global.Medicine = mongoose.model("Medicine", medicineModel);

const orderModel = new Schema(
  {
    products: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Medicines",
          required: true,
        },
        qty: { type: Number, default: 1 },
      },
    ],
    total: { type: Number, required: true },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      dsrc: { type: String },
    },
    approved: { type: Boolean, default: false },
    shipped: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
    paid: { type: Boolean, default: false },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);
global.Order = mongoose.model("Order", orderModel);

const diagnosticModel = new Schema({
  name: { type: String, required: true },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    location: {
      type: { type: String },
      coordinates: [{ type: Number }, { type: Number }],
    },
  },
  price: { type: Number, required: true },
  discount: {
    type: { type: Number, enum: ["flat", "percent"] },
    amount: { type: Number },
    dscr: { type: String },
  },
  sales: [
    {
      type: Schema.Types.ObjectId,
      ref: "Sale",
    },
  ],
  available: { type: Boolean, default: true },
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
});
diagnosticModel.statics.updateSale = (_id, sale_id) => {
  return Sales.find({ product: _id }, "_id").then((sales) =>
    Diagnostic.findByIdAndUpdate(_id, { sales: sales.map((sale) => sale._id) })
  );
};
diagnosticModel.statics.addFeedback = ({ _id, rating, feedback, user }) => {
  return Diagnostic.findById(_id).then((diagnostic) => {
    const newFeedbacks = [
      ...diagnostic.rating.reviews,
      { rating, user, feedback },
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length;
    return Diagnostic.findByIdAndUpdate(diagnostic._id, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};

global.Diagnostic = mongoose.model("Diagnostic", diagnosticModel);

const diagnosticBookingModel = new Schema(
  {
    tests: [{ type: Schema.Types.ObjectId, ref: "Diagnostic" }],
    total: { type: Number },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      dscr: { type: String },
    },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    timeToCollectSample: { type: Date },
    paid: { type: Boolean, default: false },
    sampleCollected: { type: Boolean, default: false },
    result: { type: String }, // link to pdf file stored some other db
    delivered: { type: Boolean, default: false },
    note: { type: String },
  },
  { timestamps: true }
);
global.DiagnosticBooking = mongoose.model(
  "DiagnosticBooking",
  diagnosticBookingModel
);

const salesModel = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    qty: { type: Number, required: true },
  },
  { timestamps: true }
);
global.Sales = mongoose.model("Sales", salesModel);
