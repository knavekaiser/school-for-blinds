const LocalStrategy = require("passport-local").Strategy;
// const GoogleStrategy = require("passport-google-oauth2").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
// const FacebookStrategy = require("passport-facebook").Strategy;
const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies.access_token;
  }
  return token;
};

const signToken = (_id) => {
  return jwt.sign(
    {
      iss: "schoolForBlinds",
      sub: _id,
      expiresIn: 1000 * 60 * 60 * 24 * 7,
    },
    process.env.JWT_SECRET
  );
};
const signingIn = (user, res) => {
  const token = signToken(user._id);
  ["pass", "__v"].forEach((key) => delete user[key]);
  res.cookie("access_token", token, { httpOnly: true, sameSite: true });
  res.status(200).json({ code: "ok", isAuthenticated: true, user: user });
};
const handleSignIn = (req, res) => {
  const user = JSON.parse(JSON.stringify(req.user));
  signingIn(user, res);
};

function genCode(length) {
  if (length <= 0) return;
  var result = "";
  while (result.length < length) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

// ----------------- Users
passport.use(
  "user",
  new LocalStrategy((username, password, next) => {
    User.findOne({
      $or: [{ email: username }, { phone: username }],
      active: true,
    })
      .then((user) => {
        if (user && bcrypt.compareSync(password, user.pass))
          return next(null, user);
        return next(null, false);
      })
      .catch((err) => next(err, false));
  })
);
passport.use(
  "userPrivate",
  new JwtStrategy(
    { jwtFromRequest: cookieExtractor, secretOrKey: process.env.JWT_SECRET },
    (payload, next) => {
      User.findOne({ _id: payload.sub, active: true })
        .then((user) => (user ? next(null, user) : next(null, false)))
        .catch((err) => next(err, false));
    }
  )
);

// ----------------- Vendors
passport.use(
  "vendor",
  new LocalStrategy((username, password, next) => {
    Vendor.findOne({ $or: [{ email: username }, { phone: username }] })
      .then((user) => {
        if (user && bcrypt.compareSync(password, user.pass))
          return next(null, user);
        return next(null, false);
      })
      .catch((err) => next(err, false));
  })
);
passport.use(
  "vendorPrivate",
  new JwtStrategy(
    { jwtFromRequest: cookieExtractor, secretOrKey: process.env.JWT_SECRET },
    (payload, next) => {
      Vendor.findOne({ _id: payload.sub })
        .then((user) => (user ? next(null, user) : next(null, false)))
        .catch((err) => next(err, false));
    }
  )
);

// ----------------- Vendor OAuth
// passport.use(
//   "vendorGoogle",
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "http://localhost:3001/googleAuthcalllback",
//       passReqToCallback: true,
//     },
//     function (request, accessToken, refreshToken, profile, done) {
//       Vendor.findOne({ email: profile.email }).then((user) => {
//         if (user) {
//           return done(null, user);
//         } else {
//           return done(null, null);
//         }
//       });
//     }
//   )
// );
// passport.use(
//   "vendorFacebook",
//   new FacebookStrategy(
//     {
//       clientID: process.env.FACEBOOK_APP_ID,
//       clientSecret: process.env.FACEBOOK_APP_SECRET,
//       callbackURL: "http://localhost:3001/facebookAuthCallback",
//     },
//     function (accessToken, refreshToken, profile, done) {
//       console.log(profile);
//       Vendor.findOne({ facebookId: profile.id }).then((user) => {
//         if (user) {
//           return done(null, user);
//         } else {
//           return done(null, null);
//         }
//       });
//     }
//   )
// );

// ----------------- Assistants
passport.use(
  "asst",
  new LocalStrategy((username, password, next) => {
    Assistant.findOne({ $or: [{ email: username }, { phone: username }] })
      .then((user) => {
        if (user && bcrypt.compareSync(password, user.pass))
          return next(null, user);
        return next(null, false);
      })
      .catch((err) => next(err, false));
  })
);
passport.use(
  "asstPrivate",
  new JwtStrategy(
    { jwtFromRequest: cookieExtractor, secretOrKey: process.env.JWT_SECRET },
    (payload, next) => {
      Assistant.findOne({ _id: payload.sub })
        .then((user) => (user ? next(null, user) : next(null, false)))
        .catch((err) => next(err, false));
    }
  )
);

passport.serializeUser((userData, next) => {
  const user = {
    type: userData.type ? "vendor" : userData.employeeId ? "asst" : "user",
    userId: userData._id,
  };
  return next(null, user);
});
passport.deserializeUser((user, next) => {
  const Model =
    user.type === "vendor" ? Vendor : user.type === "asst" ? Assistant : User;
  Model.findById({ $or: [{ email: user._id }, { phone: user._id }] })
    .then((user) => next(null, user))
    .catch((err) => {
      console.log(err);
      next(err);
    });
});

module.exports = { handleSignIn, signingIn, signToken, genCode };
