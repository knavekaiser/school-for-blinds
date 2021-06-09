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
  new JwtStrategy(
    { jwtFromRequest: cookieExtractor, secretOrKey: process.env.JWT_SECRET },
    (payload, next) => {
      console.log("authenticating");
      User.findOne({ _id: payload.sub })
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
      User.findOne({ email: profile.email }).then((user) => {
        if (user) {
          return done(null, user);
        } else {
          new User({
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
      User.findOne({ facebookId: profile.id }).then((user) => {
        if (user) {
          return done(null, user);
        } else {
          new User({
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

passport.serializeUser((user, next) => next(null, user._id));
passport.deserializeUser((userId, next) => {
  User.findById({ $or: [{ email: userId }, { phoneNumber: userId }] })
    .then((user) => next(null, user))
    .catch((err) => {
      console.log(err);
      next(err);
    });
});
