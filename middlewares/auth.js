const mongoose = require('mongoose');
const User = require("../models/userSchema");

// Validate ObjectID
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Middleware for user authentication (HTML responses)
const userAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (!isValidObjectId(req.session.user)) {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      return res.redirect("/login");
    });
    return;
  }

  User.findById(req.session.user)
    .then((user) => {
      if (user && !user.isBlocked) {
        req.user = user; // Attach user to request for downstream use
        next();
      } else {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
          return res.redirect("/login");
        });
      }
    })
    .catch((error) => {
      console.error("User Auth Error:", error);
      res.redirect("/login");
    });
};

// Middleware for admin authentication (HTML responses)
const adminAuth = (req, res, next) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  if (!isValidObjectId(req.session.admin)) {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      return res.redirect("/admin/login");
    });
    return;
  }

  User.findById(req.session.admin)
    .then((admin) => {
      if (admin && admin.isAdmin) {
        req.admin = admin; // Attach admin to request
        next();
      } else {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
          return res.redirect("/admin/login");
        });
      }
    })
    .catch((error) => {
      console.error("Admin Auth Error:", error);
      res.redirect("/admin/login");
    });
};

// Middleware for cart/wishlist (handles both HTML and AJAX requests)
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    const isAjaxRequest = req.xhr || req.headers.accept?.includes("json");
    if (isAjaxRequest) {
      return res.status(401).json({ status: false, message: "User not logged in" });
    }
    return res.redirect("/login");
  }
  next();
};

// Middleware for AJAX authentication
const ajaxAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ status: false, message: "User not logged in" });
  }

  if (!isValidObjectId(req.session.user)) {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      return res.status(401).json({ status: false, message: "Invalid session" });
    });
    return;
  }

  User.findById(req.session.user)
    .then((user) => {
      if (user && !user.isBlocked) {
        req.user = user; // Attach user to request
        next();
      } else {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
          return res.status(401).json({
            status: false,
            message: "User is blocked or not found",
          });
        });
      }
    })
    .catch((error) => {
      console.error("Ajax Auth Error:", error);
      res.status(500).json({
        status: false,
        message: "Internal server error",
      });
    });
};

module.exports = {
  userAuth,
  adminAuth,
  requireLogin,
  ajaxAuth,
};