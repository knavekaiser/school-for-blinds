const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const FacebookStrategy = require("passport-facebook").Strategy;
const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies.access_token;
  }
  return token;
};

passport.use(
  "user",
  new LocalStrategy((username, password, next) => {
    User.findOne({ $or: [{ email: username }, { phoneNumber: username }] })
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
      User.findOne({ _id: payload.sub })
        .then((user) => (user ? next(null, user) : next(null, false)))
        .catch((err) => next(err, false));
    }
  )
);

passport.use(
  "vendor",
  new LocalStrategy((username, password, next) => {
    Vendor.findOne({ $or: [{ email: username }, { phoneNumber: username }] })
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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3001/googleAuthcalllback",
      passReqToCallback: true,
    },
    function (request, accessToken, refreshToken, profile, done) {
      Vendor.findOne({ email: profile.email }).then((user) => {
        if (user) {
          return done(null, user);
        } else {
          new Vendor({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.email,
          })
            .save()
            .then((user) => {
              done(null, user);
            })
            .catch((err) => {
              done(err, null);
            });
        }
      });
    }
  )
);
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:3001/facebookAuthCallback",
    },
    function (accessToken, refreshToken, profile, done) {
      console.log(profile);
      Vendor.findOne({ facebookId: profile.id }).then((user) => {
        if (user) {
          return done(null, user);
        } else {
          new Vendor({
            facebookId: profile.id,
            name: profile.displayName,
            email: profile.email,
          })
            .save()
            .then((user) => {
              done(null, user);
            })
            .catch((err) => {
              done(err, null);
            });
        }
      });
    }
  )
);

passport.serializeUser((userData, next) => {
  const user = {
    type: userData.type ? "vendor" : "user",
    userId: userData._id,
  };
  return next(null, user);
});
passport.deserializeUser((user, next) => {
  const Model = user.type === "vendor" ? Vendor : User;
  Model.findById({ $or: [{ email: user._id }, { phoneNumber: user._id }] })
    .then((user) => next(null, user))
    .catch((err) => {
      console.log(err);
      next(err);
    });
});
