const productModel = new Schema(
  {
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
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
      max: { type: Number },
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
    category: { type: String },
  },
  { timestamps: true }
);
productModel.statics.updateSale = (_id, sale_id) => {
  return Sales.find({ product: _id }, "_id").then((sales) =>
    Product.findByIdAndUpdate(_id, { sales: sales.map((sale) => sale._id) })
  );
};
productModel.statics.addFeedback = ({ _id, rating, feedback, user }) => {
  return Product.findById(_id).then((product) => {
    const newFeedbacks = [
      ...product.rating.reviews,
      { rating, user, feedback },
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length;
    return Product.findByIdAndUpdate(product._id, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};

global.Product = mongoose.model("Product", productModel);

const orderModel = new Schema(
  {
    products: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: { type: Number, default: 1 },
      },
    ],
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    total: { type: Number, required: true },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      max: { type: Number },
      dscr: { type: String },
    },
    approved: { type: Boolean, default: false },
    shipped: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
    paid: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
    prescriptions: [{ type: String }],
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      location: {
        type: { type: String },
        coordinates: [{ type: Number }, { type: Number }],
      },
    },
    deliveryStaff: { type: Schema.Types.ObjectId, ref: "DeliveryStaff" },
    commission: { type: Number },
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
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  price: { type: Number, required: true },
  discount: {
    type: { type: Number, enum: ["flat", "percent"] },
    amount: { type: Number },
    max: { type: Number },
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
  vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
  dscr: { type: String },
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

const diagnosticPackageModel = new Schema({
  name: { type: String, required: true },
  vendor: { type: Schema.Types.ObjectId, ref: "Vendor" },
  tests: [{ type: Schema.Types.ObjectId, ref: "Diagnostic", required: true }],
  price: { type: Number, required: true },
  dscr: { type: String },
});
global.DiagnosticPackage = mongoose.model(
  "DiagnosticPackage",
  diagnosticPackageModel
);

global.Diagnostic = mongoose.model("Diagnostic", diagnosticModel);

const diagnosticBookingModel = new Schema(
  {
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor" },
    tests: [{ type: Schema.Types.ObjectId, ref: "Diagnostic" }],
    total: { type: Number },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      max: { type: Number },
      dscr: { type: String },
    },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    timeToCollectSample: { type: Date },
    paid: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
    sampleCollectionStaff: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryStaff",
    },
    sampleCollected: { type: Boolean, default: false },
    result: { type: String }, // link to pdf file stored some other db
    delivered: { type: Boolean, default: false },
    note: { type: String },
    commission: { type: Number },
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
global.Sale = mongoose.model("Sales", salesModel);

const productCategoryModel = new Schema({
  category: { type: String },
});
global.ProductCategory = mongoose.model(
  "ProductCategory",
  productCategoryModel
);
