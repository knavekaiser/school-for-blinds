const paymentLedgerModel = new Schema(
  {
    type: { type: String, enum: ["collection", "imbursement"], required: true },
    user: { type: Schema.Types.ObjectId },
    amount: { type: Number, required: true },
    note: { type: String, required: true },
    paymentMethod: { type: String },
    transactionId: { type: String, unique: true, sparse: true },
    product: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);
global.PaymentLedger = mongoose.model("PaymentLedger", paymentLedgerModel);

global.ShopLedger = PaymentLedger.discriminator(
  "ShopLedger",
  new Schema({
    shop: {
      name: { type: String },
      address: {},
      phone: { type: String },
      email: { type: String },
      gstin: { type: String },
      dl: { type: String },
      branch: { type: String },
    },
    customer: {
      name: { type: String },
      address: {},
      phone: { type: String },
    },
    refDoctor: {
      name: { type: String },
      regNo: { type: String },
    },
  })
);

global.DoctorLedger = PaymentLedger.discriminator(
  "DoctorLedger",
  new Schema({
    clinic: {
      name: { type: String },
    },
    doctor: {
      name: { type: String },
      education: { type: String },
      speciality: { type: String },
      regNo: { type: String },
      about: { type: String },
    },
    patient: {
      name: { type: String },
      age: { type: String },
      gender: { type: String },
      phone: { type: String },
    },
    consultant: { type: String },
    officeId: { type: String },
  })
);

const payoutModel = new Schema(
  {
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    date: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    amount: { type: Number, required: true },
    status: { type: String, default: "pending" },
    ledgers: [{ type: Schema.Types.ObjectId, ref: "PaymentLedger" }],
  },
  { timestamps: true }
);
global.Payout = mongoose.model("Payout", payoutModel);
