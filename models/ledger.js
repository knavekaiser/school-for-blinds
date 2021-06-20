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
