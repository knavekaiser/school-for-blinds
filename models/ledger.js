const clientToClientLedgerModel = new Schema(
  {
    from: { type: Schema.Types.ObjectId, required: true },
    to: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    note: { type: String },
    paymentMethod: { type: String },
    transactionId: { type: String },
  },
  { timestamps: true }
);
global.ClientToClientLedger = mongoose.model(
  "ClientToClientLedger",
  clientToClientLedgerModel
);

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
