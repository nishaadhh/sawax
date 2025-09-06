const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const validator = require("validator");
const env = require("dotenv").config();
const Address = require("../../models/addressSchema");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/images/profiles/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Utility function for OTP generation
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Shared utility for sending verification email
const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP For Email Verification",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP is <span style="color:blue;">${otp}</span></h4></b>`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.messageId);
    return true;
  } catch (error) {
    console.error("Error in sending email:", error);
    return false;
  }
};

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/errorpage?message=user-not-found");
    }
    res.render("profile", { 
      user: userData,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.redirect("/errorpage?message=profile-fetch-error");
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, email, username } = req.body;

    // Validate inputs
    if (!name || !email) {
      return res.redirect("/profile?error=Name and email are required");
    }

    if (!validator.isEmail(email)) {
      return res.redirect("/profile?error=Invalid email format");
    }

    if (username) {
      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.redirect("/profile?error=Username can only contain letters, numbers, and underscores");
      }

      if (username.length < 3 || username.length > 30) {
        return res.redirect("/profile?error=Username must be between 3 and 30 characters");
      }

      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username: username, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.redirect("/profile?error=Username is already taken");
      }
    }

    // Check if email is already taken by another user
    const existingEmail = await User.findOne({ 
      email: email, 
      _id: { $ne: userId } 
    });
    if (existingEmail) {
      return res.redirect("/profile?error=Email is already in use");
    }

    // Update user data
    const updateData = { name, email };
    if (username) {
      updateData.username = username;
    }

    await User.findByIdAndUpdate(userId, updateData);
    res.redirect("/profile?message=Profile updated successfully");
  } catch (error) {
    console.error("Error updating profile:", error);
    res.redirect("/profile?error=Error updating profile");
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    const imagePath = '/images/profiles/' + req.file.filename;
    
    // Get current user to check for old profile image
    const user = await User.findById(userId);
    
    // Delete old profile image if it exists and is not the default
    if (user.profileImage && 
        user.profileImage !== '/images/default-avatar.png' && 
        !user.profileImage.includes('placeholder')) {
      try {
        const oldImagePath = path.join('public', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      } catch (deleteError) {
        console.error("Error deleting old profile image:", deleteError);
      }
    }
    
    // Update user's profile image in database
    await User.findByIdAndUpdate(userId, { profileImage: imagePath });
    
    res.json({ 
      success: true, 
      message: 'Profile picture updated successfully!',
      imagePath: imagePath
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    
    // Delete uploaded file if database update failed
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error("Error deleting uploaded file:", deleteError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading profile picture' 
    });
  }
};

const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    const userId = req.session.user;
    
    if (!username) {
      return res.json({ available: false, message: 'Username is required' });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.json({ 
        available: false, 
        message: 'Username can only contain letters, numbers, and underscores' 
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.json({ 
        available: false, 
        message: 'Username must be between 3 and 30 characters' 
      });
    }

    // Check if username exists (excluding current user)
    const existingUser = await User.findOne({ 
      username: username, 
      _id: { $ne: userId } 
    });
    
    if (existingUser) {
      return res.json({ 
        available: false, 
        message: 'Username is already taken' 
      });
    }

    res.json({ 
      available: true, 
      message: 'Username is available' 
    });
  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({ 
      available: false, 
      message: 'Error checking username availability' 
    });
  }
};

const changeEmail = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({_id:userId})
    res.render("change-email", { message: null ,user:userData});
  } catch (error) {
    console.error("Error rendering change email page:", error);
    res.redirect("/errorpage?message=render-error");
  }
};

const changeEmailValid = async (req, res) => {
  try {
    const { currentEmail, newEmail, confirmEmail, password } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.render("change-email", { message: "Please log in to change your email", user: { email: currentEmail } });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("change-email", { message: "User not found", user: { email: currentEmail } });
    }

    if (user.email !== currentEmail) {
      return res.render("change-email", { message: "Current email does not match", user: { email: currentEmail } });
    }

    if (!validator.isEmail(newEmail)) {
      return res.render("change-email", { message: "Invalid new email format", user: { email: currentEmail } });
    }

    if (newEmail !== confirmEmail) {
      return res.render("change-email", { message: "New email and confirm email do not match", user: { email: currentEmail } });
    }

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.render("change-email", { message: "New email is already in use", user: { email: currentEmail } });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("change-email", { message: "Incorrect password", user: { email: currentEmail } });
    }

    user.email = newEmail;
    await user.save();
    
    res.render("change-email", { message: "Email updated successfully", user: { email: newEmail }, redirect: "/profile" });
  } catch (error) {
    console.error("Error in changeEmail:", error);
    res.redirect("/errorpage?message=email-change-error");
  }
};

const changePassword = async (req, res) => {
  try {
    res.render("change-password", { message: null });
  } catch (error) {
    console.error("Error rendering change password page:", error);
    res.redirect("/errorpage?message=render-error");
  }
};

const changePasswordValid = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    console.log("Form data:", { currentPassword, newPassword, confirmPassword, userId });

    if (!currentPassword || !newPassword || !confirmPassword) {
      console.log("Missing form fields");
      return res.render("change-password", { message: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.render("change-password", { message: "User not found" });
    }

    console.log("User data:", { email: user.email, hasPassword: !!user.password });

    if (!user.password) {
      console.log("No password found for user:", user.email);
      return res.render("change-password", {
        message: "Password changes are not available for accounts registered via Google or other OAuth providers. Please use password reset.",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log("Current password incorrect for user:", user.email);
      return res.render("change-password", { message: "Incorrect current password" });
    }

    if (newPassword !== confirmPassword) {
      console.log("New passwords do not match");
      return res.render("change-password", { message: "New passwords do not match" });
    }

    if (newPassword.length < 8) {
      console.log("New password too short");
      return res.render("change-password", { message: "New password must be at least 8 characters long" });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.log("New password does not meet complexity requirements");
      return res.render("change-password", {
        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    console.log("Password updated successfully for user:", user.email);

    res.redirect("/profile?message=Password+updated+successfully");
  } catch (error) {
    console.error("Error in changePasswordValid:", error);
    res.redirect("/errorpage?message=password-change-error");
  }
};

const cart = async (req, res) => {
  try{
    res.render("addToCart", { message: null });
  }catch (error) {
    console.error("Error rendering cart page:", error);
    res.redirect("/errorpage?message=render-error");
  }
} 

const loadAddressPage = async (req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId:userId})
        
        res.render("address",{
            user:userData,
            userAddress:addressData,
        })
    } catch (error) {
        console.error("Error in Address loading",error);
        res.redirect("/pageNotFound");
    }
}

const addAddress = async (req,res) => {
    try {
        const user = req.session.user;
        const userData = await User.findById(user);
        res.render("add-address",{
            theUser:user,
            user:userData
        })
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postAddAddress = async (req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId})
        const { addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone } = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        
        if(!userAddress){
            const newAddress = new Address({
                userId:userData,
                address: [{addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone}]
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone})
            await userAddress.save();
        }

        res.redirect("/address")
    } catch (error) {
        console.error("Error adding address",error)
        res.redirect("/pageNotFound")
    }
}

const editAddress = async (req,res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id":addressId,
        });
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();
        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }

        res.render("edit-address",{
            address:addressData,
            user:user
        })
    } catch (error) {
        console.error("Error in edit Address",error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req,res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({
            "address._id":addressId
        });
        if(!findAddress){
            res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name:data.name,
                    country:data.country,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    streetAddress:data.streetAddress,
                    pincode:data.pincode,
                    phone:data.phone,
                    email:data.email,
                    altPhone:data.altPhone
                }
            }}
        )

        res.redirect("/address")
    } catch (error) {
        console.error("Error in editing address",error)
        res.redirect("/pageNotFound")
    }
}

const deleteAddress = async (req,res) => {
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId})

        if(!findAddress){
            return res.status(404).send("Address Not Found")
        }

        await Address.updateOne(
        {
            "address._id":addressId
        },
        {
            $pull: {
                address:{
                    _id:addressId,
                }
            }
        })

        res.redirect("/address")
    } catch (error) {
        console.error("Error in deleting in address",error)
        res.redirect("/pageNotFound")
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error:", err.message);
                return res.redirect('/pageNotFound');
            }
            return res.redirect('/login?refresh=true');
        });
    } catch (error) {
        console.log("Logout error:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
  userProfile,
  updateProfile,
  uploadProfileImage,
  checkUsernameAvailability,
  changeEmail,
  changeEmailValid,
  sendVerificationEmail,
  changePassword,
  changePasswordValid,
  loadAddressPage,
  addAddress,
  postAddAddress,
  editAddress,
  postEditAddress,
  deleteAddress,
  upload,
  logout
};