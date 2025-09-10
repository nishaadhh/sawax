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
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalName));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalName).toLowerCase());
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
    const transporter = nodemailer.createTransport({
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

    if (!name || !email) {
      return res.redirect("/profile?error=Name and email are required");
    }

    if (!validator.isEmail(email)) {
      return res.redirect("/profile?error=Invalid email format");
    }

    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.redirect("/profile?error=Username can only contain letters, numbers, and underscores");
      }

      if (username.length < 3 || username.length > 30) {
        return res.redirect("/profile?error=Username must be between 3 and 30 characters");
      }

      const existingUser = await User.findOne({ 
        username: username, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.redirect("/profile?error=Username is already taken");
      }
    }

    const existingEmail = await User.findOne({ 
      email: email, 
      _id: { $ne: userId } 
    });
    if (existingEmail) {
      return res.redirect("/profile?error=Email is already in use");
    }

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
    
    const user = await User.findById(userId);
    
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
    
    await User.findByIdAndUpdate(userId, { profileImage: imagePath });
    
    res.json({ 
      success: true, 
      message: 'Profile picture updated successfully!',
      imagePath: imagePath
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    
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
    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/errorpage?message=user-not-found");
    }
    res.render("change-email", { 
      message: req.query.message || null,
      user: userData
    });
  } catch (error) {
    console.error("Error rendering change email page:", error);
    res.redirect("/errorpage?message=render-error");
  }
};

const sendCurrentEmailOtp = async (req, res) => {
  try {
    const { currentEmail, password } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.render("change-email", { 
        message: "Please log in to change your email", 
        user: { email: currentEmail } 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("change-email", { 
        message: "User not found", 
        user: { email: currentEmail } 
      });
    }

    if (user.email !== currentEmail) {
      return res.render("change-email", { 
        message: "Current email does not match", 
        user: { email: currentEmail } 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("change-email", { 
        message: "Incorrect password", 
        user: { email: currentEmail } 
      });
    }

    // Generate OTP and send to current email
    const otp = generateOtp();
    console.log(otp)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store pending email verification data in session
    req.session.pendingEmailVerification = {
      userId: userId,
      currentEmail: currentEmail,
      otp: otp,
      otpExpiry: otpExpiry,
      createdAt: new Date()
    };

    // Send OTP to current email
    const emailSent = await sendVerificationEmail(currentEmail, otp);
    
    if (!emailSent) {
      return res.render("change-email", { 
        message: "Failed to send verification email. Please try again.", 
        user: { email: currentEmail } 
      });
    }

    res.redirect(`/verify-current-email-otp-page?message=OTP+sent+to+${encodeURIComponent(currentEmail)}`);
  } catch (error) {
    console.error("Error in sendCurrentEmailOtp:", error);
    res.redirect("/errorpage?message=email-otp-send-error");
  }
};

const verifyCurrentEmailOtpPage = async (req, res) => {
  try {
    if (!req.session.pendingEmailVerification) {
      return res.redirect("/change-email?message=Session+expired");
    }

    const { currentEmail } = req.session.pendingEmailVerification;
    
    res.render("otp-verification-email", { 
      message: req.query.message || null,
      currentEmail: currentEmail
    });
  } catch (error) {
    console.error("Error rendering OTP verification page:", error);
    res.redirect("/errorpage?message=render-error");
  }
};

const verifyCurrentEmailOtp = async (req, res) => {
  try {
    const { digit1, digit2, digit3, digit4, digit5, digit6 } = req.body;
    const enteredOtp = digit1 + digit2 + digit3 + digit4 + digit5 + digit6;

    if (!req.session.pendingEmailVerification) {
      return res.render("otp-verification-email", { 
        message: "Session expired. Please try changing your email again.",
        currentEmail: ""
      });
    }

    const { userId, currentEmail, otp, otpExpiry } = req.session.pendingEmailVerification;

    // Check if OTP has expired
    if (new Date() > new Date(otpExpiry)) {
      delete req.session.pendingEmailVerification;
      return res.render("otp-verification-email", { 
        message: "OTP has expired. Please request a new one.",
        currentEmail: currentEmail
      });
    }

    // Verify OTP
    if (enteredOtp !== otp) {
      return res.render("otp-verification-email", { 
        message: "Invalid OTP. Please try again.",
        currentEmail: currentEmail
      });
    }

    // OTP is valid, proceed to new email input page
    res.redirect("/new-email");
  } catch (error) {
    console.error("Error verifying email OTP:", error);
    res.redirect("/errorpage?message=otp-verification-error");
  }
};

const resendCurrentEmailOtp = async (req, res) => {
  try {
    if (!req.session.pendingEmailVerification) {
      return res.json({ 
        success: false, 
        message: "No pending email verification found. Please start the process again." 
      });
    }

    const { currentEmail } = req.session.pendingEmailVerification;

    // Generate new OTP
    const newOtp = generateOtp();
    const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update session with new OTP
    req.session.pendingEmailVerification.otp = newOtp;
    req.session.pendingEmailVerification.otpExpiry = newOtpExpiry;

    // Send new OTP to email
    const emailSent = await sendVerificationEmail(currentEmail, newOtp);
    
    if (!emailSent) {
      return res.json({ 
        success: false, 
        message: "Failed to send verification email. Please try again." 
      });
    }

    res.json({ 
      success: true, 
      message: "New OTP sent successfully" 
    });
  } catch (error) {
    console.error("Error resending email OTP:", error);
    res.json({ 
      success: false, 
      message: "Error resending OTP. Please try again." 
    });
  }
};

const newEmailPage = async (req, res) => {
  try {
    if (!req.session.pendingEmailVerification) {
      return res.redirect("/change-email?message=Session+expired");
    }

    const { currentEmail } = req.session.pendingEmailVerification;
    
    res.render("new-email", { 
      message: null,
      currentEmail: currentEmail
    });
  } catch (error) {
    console.error("Error rendering new email page:", error);
    res.redirect("/errorpage?message=render-error");
  }
};

const updateNewEmail = async (req, res) => {
  try {
    const { newEmail, confirmEmail } = req.body;
    const userId = req.session.user;

    if (!req.session.pendingEmailVerification) {
      return res.render("new-email", { 
        message: "Session expired. Please try changing your email again.", 
        currentEmail: ""
      });
    }

    const { currentEmail } = req.session.pendingEmailVerification;

    // Validate new email
    if (!validator.isEmail(newEmail)) {
      return res.render("new-email", { 
        message: "Invalid new email format", 
        currentEmail: currentEmail 
      });
    }

    if (newEmail !== confirmEmail) {
      return res.render("new-email", { 
        message: "New email and confirm email do not match", 
        currentEmail: currentEmail 
      });
    }

    if (newEmail === currentEmail) {
      return res.render("new-email", { 
        message: "New email must be different from current email", 
        currentEmail: currentEmail 
      });
    }

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.render("new-email", { 
        message: "New email is already in use", 
        currentEmail: currentEmail 
      });
    }

    // Update user email
    await User.findByIdAndUpdate(userId, { email: newEmail });

    // Clear session data
    delete req.session.pendingEmailVerification;

    res.redirect("/profile?message=Email+updated+successfully");
  } catch (error) {
    console.error("Error in updateNewEmail:", error);
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
            if (req.headers['content-type'] === 'application/json') {
                return res.status(404).json({ success: false, message: 'Address not found' });
            }
            return res.redirect("/pageNotFound");
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
        );

        if (req.headers['content-type'] === 'application/json') {
            return res.json({ success: true, message: 'Address updated successfully' });
        }
        
        res.redirect("/address");
    } catch (error) {
        console.error("Error in editing address",error);
        
        if (req.headers['content-type'] === 'application/json') {
            return res.status(500).json({ success: false, message: 'Error updating address' });
        }
        
        res.redirect("/pageNotFound");
    }
}

const deleteAddress = async (req,res) => {
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId})

        if(!findAddress){
            return res.redirect("/address?error=Address+not+found");
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

        res.redirect("/address?deleted=true")
    } catch (error) {
        console.error("Error in deleting in address",error)
        res.redirect("/address?error=Error+deleting+address")
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
  sendCurrentEmailOtp,
  verifyCurrentEmailOtpPage,
  verifyCurrentEmailOtp,
  resendCurrentEmailOtp,
  newEmailPage,
  updateNewEmail,
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