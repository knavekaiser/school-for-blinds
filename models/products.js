const medicineModel = new Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String },
    dscr: { type: String },
    brand: { type: String, required: true },
    price: { type: Number },
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
        ref: "Sales",
      },
    ],
  },
  { timestamps: true }
);
medicineModel.statics.addSale = (_id, sale_id) => {
  Sales.find({ product: _id }, "_id").then((sales) =>
    Medicine.findByIdAndUpdate(_id, { sales: sales.map((sale) => sale._id) })
  );
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
    customer: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      address: {
        shipping: {
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
        billing: {
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
      },
    },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

global.Order = mongoose.model("Order", orderModel);

const salesModel = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "medicineModel",
      required: true,
    },
    qty: { type: Number, required: true },
  },
  { timestamps: true }
);

global.Sales = mongoose.model("Sales", salesModel);

const diagnosticModel = new Schema({
  name: { type: String },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    location: {
      type: { type: String },
      coordinates: [{ type: Number }, { type: Number }],
    },
  },
  price: { type: Number },
  discount: {
    type: { type: Number, enum: ["flat", "percent"] },
    amount: { type: Number },
    dscr: { type: String },
  },
  sales: [
    {
      type: Schema.Types.ObjectId,
      ref: "Sales",
    },
  ],
  available: { type: Boolean, default: true },
});
diagnosticModel.statics.addSale = (_id, sale_id) => {
  Sales.find({ product: _id }, "_id").then((sales) =>
    Diagnostic.findByIdAndUpdate(_id, { sales: sales.map((sale) => sale._id) })
  );
};

global.Diagnostic = mongoose.model("Diagnostic", diagnosticModel);

const diagnosticBookingModel = new Schema(
  {
    test: { type: Schema.Types.ObjectId },
    total: { type: Number },
    discount: {
      type: { type: Number, enum: ["flat", "percent"] },
      amount: { type: Number },
      dscr: { type: String },
    },
    customer: {
      name: { type: String, required: true },
      gender: { type: String, required: true },
      mobile: { type: String, required: true },
      email: { type: String },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        location: {
          type: { type: String },
          coordinates: [
            {
              type: Number,
            },
          ],
        },
        confirmed: { type: Boolean, default: true },
      },
      timeToCollectSample: { type: Date },
    },
    paid: { type: Boolean, default: false },
    sampleCollected: { type: Boolean, default: false },
    result: { type: String }, // link to pdf file stored some other db
    delivered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

global.DiagnosticBooking = mongoose.model(
  "DiagnosticBooking",
  diagnosticBookingModel
);
