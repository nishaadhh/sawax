const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const validator = require("validator");
const env = require("dotenv").config();
const Address = require("../../models/addressSchema");

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
    res.render("profile", { user: userData });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.redirect("/errorpage?message=profile-fetch-error");
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

    // 1. Check if the user is logged in
    if (!userId) {
      return res.render("change-email", { message: "Please log in to change your email", user: { email: currentEmail } });
    }

    // 2. Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.render("change-email", { message: "User not found", user: { email: currentEmail } });
    }

    // 3. Verify the current email matches the user's email
    if (user.email !== currentEmail) {
      return res.render("change-email", { message: "Current email does not match", user: { email: currentEmail } });
    }

    // 4. Validate the new email
    if (!validator.isEmail(newEmail)) {
      return res.render("change-email", { message: "Invalid new email format", user: { email: currentEmail } });
    }

    // 5. Check if new email matches confirm email
    if (newEmail !== confirmEmail) {
      return res.render("change-email", { message: "New email and confirm email do not match", user: { email: currentEmail } });
    }

    // 6. Check if the new email is already in use
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.render("change-email", { message: "New email is already in use", user: { email: currentEmail } });
    }

    // 7. Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render("change-email", { message: "Incorrect password", user: { email: currentEmail } });
    }

    // 8. Update the user's email
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

    // Log form data for debugging
    console.log("Form data:", { currentPassword, newPassword, confirmPassword, userId });

    // Validate form inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      console.log("Missing form fields");
      return res.render("change-password", { message: "All fields are required" });
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.render("change-password", { message: "User not found" });
    }

    // Log user data for debugging
    console.log("User data:", { email: user.email, hasPassword: !!user.password });

    // Check if user has a password (handle OAuth users)
    if (!user.password) {
      console.log("No password found for user:", user.email);
      return res.render("change-password", {
        message: "Password changes are not available for accounts registered via Google or other OAuth providers. Please use password reset.",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log("Current password incorrect for user:", user.email);
      return res.render("change-password", { message: "Incorrect current password" });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      console.log("New passwords do not match");
      return res.render("change-password", { message: "New passwords do not match" });
    }

    // Validate new password
    if (newPassword.length < 8) {
      console.log("New password too short");
      return res.render("change-password", { message: "New password must be at least 8 characters long" });
    }

    // Additional password validation (e.g., complexity)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.log("New password does not meet complexity requirements");
      return res.render("change-password", {
        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    console.log("Password updated successfully for user:", user.email);

    // Redirect to profile with success message
    res.redirect("/profile?message=Password+updated+successfully");
  } catch (error) {
    console.error("Error in changePasswordValid:", error);
    res.redirect("/errorpage?message=password-change-error");
  }
};



// const addToCart = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const productId = req.body.productId;

//     // Validate input
//     if (!userId || !productId) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     // Add product to cart logic here
//     // ...

//     res.status(200).json({ message: "Product added to cart" });
//   } catch (error) {
//     console.error("Error adding to cart:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

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






module.exports = {
  userProfile,
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
};