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
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: { type: String, unique: true, sparse: true },
    pass: { type: String },
    keywords: [{ type: String }],
    available: { type: Boolean, default: true },
    subscription: {
      nextBillingDate: { type: Date },
      accountStatus: { type: String, default: "trial" },
    },
    commission: { type: Number },
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    gallery: [{ type: String }],
    notifications: [
      new Schema(
        {
          title: { type: String, required: true },
          body: { type: String, required: true },
          link: { type: String },
        },
        { timestamps: true }
      ),
    ],
  },
  { timestamps: true, discriminatorKey: "type" }
);
vendorModel.statics.updateBooking = (_id) => {
  if (!ObjectId.isValid(_id)) return;
  return Book.find({ vendor: _id }, "_id").then((allBookings) =>
    Vendor.findByIdAndUpdate(_id, {
      bookings: allBookings.map((item) => item._id),
    })
  );
};
vendorModel.statics.addFeedback = ({ vendor, rating, feedback, user }) => {
  return Book.findOne({ vendor, user, completed: true }).then(
    (bookCompleted) => {
      if (bookCompleted) {
        return Vendor.findById(vendor).then((vendor) => {
          const newFeedbacks = [
            ...vendor.rating.reviews.filter(
              (review) => review.user.toString() !== user.toString()
            ),
            { rating, user, feedback },
          ];
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
      } else {
        throw "forbidden";
      }
    }
  );
};
vendorModel.statics.deleteFeedback = ({ vendor, user }) => {
  return Vendor.findById(vendor).then((dbVendor) => {
    const newFeedbacks = [
      ...dbVendor.rating.reviews.filter(
        (review) => review.user.toString() !== user.toString()
      ),
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length || 0;
    return Vendor.findByIdAndUpdate(vendor, {
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
    speciality: [{ type: String, required: true }],
    assistants: [
      {
        profile: {
          type: Schema.Types.ObjectId,
          ref: "Assistant",
        },
        canApproveAppointments: { type: Boolean, default: false },
      },
    ],
    bookings: [{ type: Schema.Types.ObjectId, ref: "Book", required: true }],
    onlineBooking: { type: Boolean, default: true },
    chambers: [
      {
        _id: { type: Schema.Types.ObjectId, default: new ObjectId() },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: Number, required: true },
        charge: { type: Number, required: true },
        open: { type: Boolean, default: true },
        visitingDays: [
          {
            day: { type: Number, required: true },
            hours: [
              {
                from: { type: String, required: true },
                to: { type: String, required: true },
              },
            ],
          },
        ],
        sessionLength: { type: Number },
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
    ],
    chat: {
      onGoing: { type: Boolean, default: false },
      available: { type: Boolean, default: false },
      charge: { type: Number },
      sessionLength: { type: Number },
      days: [
        {
          day: { type: Number, required: true },
          hours: [
            {
              from: { type: String, required: true },
              to: { type: String, required: true },
            },
          ],
        },
      ],
    },
    teleConsult: {
      onGoing: { type: Boolean, default: false },
      available: { type: Boolean, default: false },
      charge: { type: Number },
      sessionLength: { type: Number },
      days: [
        {
          day: { type: Number, required: true },
          hours: [
            {
              from: { type: String, required: true },
              to: { type: String, required: true },
            },
          ],
        },
      ],
    },
    age: { type: Number, required: true },
    gender: { type: String },
    education: { type: String },
    yearsOfExp: { type: Number },
  })
);
global.Clinic = Vendor.discriminator(
  "Clinic",
  new Schema({
    speciality: [{ type: String, required: true }],
    assistants: [
      {
        profile: {
          type: Schema.Types.ObjectId,
          ref: "Assistant",
        },
        canApproveAppointments: { type: Boolean, default: false },
      },
    ],
    bookings: [{ type: Schema.Types.ObjectId, ref: "Book", required: true }],
    onlineBooking: { type: Boolean, default: true },
    chambers: [
      {
        doctor: { type: Schema.Types.ObjectId, required: true, ref: "Vendor" },
        _id: { type: Schema.Types.ObjectId, default: new ObjectId() },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: Number, required: true },
        charge: { type: Number, required: true },
        open: { type: Boolean, default: true },
        visitingDays: [
          {
            day: { type: Number, required: true },
            hours: [
              {
                from: { type: String, required: true },
                to: { type: String, required: true },
              },
            ],
          },
        ],
        sessionLength: { type: Number },
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
    ],
    doctors: [
      {
        type: Schema.Types.ObjectId,
        ref: "Doctor",
        required: true,
      },
    ],
  })
);
global.Pharmacy = Vendor.discriminator(
  "Pharmacy",
  new Schema({
    deliveryStaffs: [{ type: Schema.Types.ObjectId, ref: "DeliveryStaff" }],
    shops: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          default: new ObjectId(),
        },
        name: { type: String, required: true },
        categoryOfShop: { type: String, required: true },
        registrationNumber: { type: String, required: true, unique: true },
        legalDocuments: [{ type: String }],
        paymentOptions: [{ type: String }],
        gallery: [{ type: String }],
        address: {
          street: { type: String },
          city: { type: String },
          state: { type: String },
          zip: { type: Number },
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
        delivery: { type: Boolean, default: true },
        pickup: { type: Boolean, default: true },
        active: { type: Boolean, deafault: true },
      },
    ],
  })
);
global.DiagnosticCentre = Vendor.discriminator(
  "DiagnosticCentre",
  new Schema({})
);

const bookModel = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    date: { type: Date, required: true },
    sessionLength: { type: Number },
    charge: { type: Number },
    chamber: {
      type: Schema.Types.ObjectId,
      ref: "Vendor.chamber",
      required: true,
    },
    completed: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    paid: { type: Boolean, default: false },
    reasonForVisit: { type: String },
    note: { type: String },
    userReview: {
      rating: { type: Number },
      feedback: { type: String },
    },
  },
  { timestamps: true }
);
global.Book = mongoose.model("Book", bookModel);

const prescirptionModel = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor" },
    img: { type: String },
    date: { type: Date, default: Date.now },
    medicines: [
      {
        name: { type: String },
        brand: { type: String },
        timePeriod: {
          from: { type: Date },
          to: { type: Date },
        },
        instruction: { type: String },
      },
    ],
    advice: { type: String },
    medicineOrdered: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true }
);
global.Prescription = mongoose.model("Prescription", prescirptionModel);

const blogModel = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    topic: { type: String },
    keywords: [{ type: String }],
    body: { type: String, required: true },
  },
  { timestamps: true }
);
global.Blog = mongoose.model("Blog", blogModel);

const teleConsultModel = new Schema(
  {
    token: { type: Number, required: true },
    date: { type: Date, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "vendors", required: true },
    user: { type: Schema.Types.ObjectId, ref: "users", required: true },
    charge: { type: Number },
    sessionLength: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);
global.TeleConsult = mongoose.model("TeleConsult", teleConsultModel);

const chatModel = new Schema(
  {
    token: { type: Number, required: true },
    date: { type: Date, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "vendors", required: true },
    user: { type: Schema.Types.ObjectId, ref: "users", required: true },
    charge: { type: Number },
    sessionLength: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);
global.Chat = mongoose.model("Chat", chatModel);

const assistantModel = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    pass: { type: String },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor" },
    gender: { type: String },
    age: { type: String },
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
    approved: { type: Boolean, default: false },
    employeeId: { type: String, required: true },
    notifications: [
      new Schema(
        {
          title: { type: String, required: true },
          body: { type: String, required: true },
          link: { type: String },
        },
        { timestamps: true }
      ),
    ],
  },
  { timestamps: true }
);
global.Assistant = mongoose.model("Assistant", assistantModel);

const specialityModel = new Schema({
  name: { type: String, required: true },
  symptoms: { type: String },
});
global.Speciality = mongoose.model("Speciality", specialityModel);

const OTPModel = new Schema(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expireAt: { type: Date, default: Date.now, index: { expires: "2m" } },
    attempt: { type: Number, default: 0 },
  },
  { timestamps: true }
);
global.OTP = mongoose.model("OTP", OTPModel);

const deliveryStaffModel = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    pass: { type: String, required: true },
    legalDocuments: [{ type: String }],
    age: { type: String },
    gender: { type: Number },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    healthStatus: { type: String },
    profileImg: { type: String },
    available: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    onDelivery: { type: Boolean, default: false },
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
    notifications: [
      new Schema(
        {
          title: { type: String, required: true },
          body: { type: String, required: true },
          link: { type: String },
        },
        { timestamps: true }
      ),
    ],
  },
  { timestamps: true }
);
deliveryStaffModel.statics.addFeedback = ({
  staff,
  rating,
  feedback,
  user,
}) => {
  return DeliveryStaff.findById(staff).then((staff) => {
    const newFeedbacks = [
      ...staff.rating.reviews.filter(
        (review) => review.user.toString() !== user.toString()
      ),
      { rating, user, feedback },
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length;
    return DeliveryStaff.findByIdAndUpdate(staff._id, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};
deliveryStaffModel.statics.deleteFeedback = ({ staff, user }) => {
  return DeliveryStaff.findById(staff).then((dbStaff) => {
    const newFeedbacks = [
      ...dbStaff.rating.reviews.filter(
        (review) => review.user.toString() !== user.toString()
      ),
    ];
    const newTotalRating =
      newFeedbacks.reduce((a, c) => {
        return a + c.rating;
      }, 0) / newFeedbacks.length || 0;
    return DeliveryStaff.findByIdAndUpdate(staff, {
      rating: {
        totalRating: newTotalRating,
        reviews: newFeedbacks,
      },
    });
  });
};
global.DeliveryStaff = mongoose.model("DeliveryStaff", deliveryStaffModel);
