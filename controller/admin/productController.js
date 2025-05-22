const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const sharp = require("sharp")
const path = require("path")
const fs = require("fs")

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true })
    res.render("product-add", {
      cat: category,
    })
  } catch (error) {
    console.error("Error loading product add page:", error)
    res.status(500).json({ success: false, message: "Error loading product add page" })
  }
}

const saveImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Generate unique filename
    const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
    const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

    // Resize & convert to WebP
    await sharp(file.buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    return res.status(200).json({ success: true, message: "Image saved successfully", filename });
  } catch (error) {
    console.error("Error saving image:", error);
    return res.status(500).json({ success: false, message: "Error saving image" });
  }
};

// 🟢 Add Product with Multiple Image Upload (using Sharp)
const addProducts = async (req, res) => {
  try {
                  console.log(" req.body",req.files);  
    const {   productName,
  description,
  brand,
  salePrice,
  quantity,
  color,
  category} = req.body;
    const files = req.files;
      
      
 



    // Ensure upload directory exists
    const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process images using Sharp
    const imageFilenames = [];


    for (let key in files) {
      for (const file of files[key]) {
        const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
        const filePath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filePath);

        imageFilenames.push(`uploads/product-images/${filename}`);
      }
    }
          console.log(" sucessfull newProduct  PHOTO ",imageFilenames ); 

    // Find category by name (ensure it exists)
    const foundCategory = await Category.findOne({ name: category });
    if (!foundCategory) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

          console.log(" sucessfull newProduct 2 " ); 


    // Create and save new product
    const newProduct = new Product({
      productName,
      description,
       brand,
      category: foundCategory._id, // Save category as ObjectId
      salePrice,
      quantity,
      color,
      productImage: imageFilenames,
      status: "available",
    });
    console.log(" sucessfull newProduct");  

    await newProduct.save();
    return res.status(200).json({ success: true, message: "Product added successfully" });
  } catch (error) {
    console.error("Error saving product:", error);
    return res.status(500).json({ success: false, message: "Error saving product" });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")  // Ensure population of category
      .exec();

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    }).countDocuments();

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      res.render("admin-error");
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("admin-error");
  }
};





const addProductOffer = async (req, res) => {
  try {
      const { productId, percentage } = req.body;
      const product = await Product.findById(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: "Product not found" });
      }

      product.productOffer = parseInt(percentage);
      product.salePrice = Math.round(product.regularPrice * (1 - percentage / 100));
      await product.save();

      res.json({ status: true, message: "Offer added successfully" });
  } catch (error) {
      console.error("Error in addProductOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
      const { productId } = req.body;
      const product = await Product.findById(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: "Product not found" });
      }

      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();

      res.json({ status: true, message: "Offer removed successfully" });
  } catch (error) {
      console.error("Error in removeProductOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const blockProduct = async (req,res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/products")
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }
}

const unblockProduct = async (req,res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/products")
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }
}

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id
    const product = await Product.findOne({ _id: id }).populate("category")
    const categories = await Category.find({})

    if (!product) {
      return res.status(404).send("Product not found")
    }

    res.render("product-edit", {
      product: product,
      cat: categories,
    })
  } catch (error) {
    console.error("Error in getEditProduct:", error)
    res.redirect("/pageerror")
  }
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { 
      productName, description, salePrice, 
      quantity, color, brand, category 
    } = req.body;

    const existingProduct = await Product.findOne({
      productName: productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product with this name already exists. Please try another name." });
    }

    const updateFields = {
      productName,
      description,
      salePrice,
      quantity,
      color,
      brand,
      category,
    };

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Handle image updates
    for (let i = 1; i <= 4; i++) {
      if (req.files[`image${i}`]) {
        const file = req.files[`image${i}`][0];
        const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
        const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath);

        const imagePath = `uploads/product-images/${filename}`;
        
        if (product.productImage[i-1]) {
          product.productImage[i-1] = imagePath;
        } else {
          product.productImage.push(imagePath);
        }
      }
    }

    Object.assign(product, updateFields);
    await product.save();

    // res.json({ success: true, message: "Product updated successfully" });
    res.redirect("/admin/products")

  } catch (error) {
    console.error("Error in editProduct:", error);
    res.status(500).json({ success: false, message: "An error occurred while updating the product" });
  }
};


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body;
    const product = await Product.findById(productIdToServer);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Remove the image from the array
    product.productImage.splice(imageIndex, 1);
    await product.save();

    const imagePath = path.join(__dirname, "../../public", imageNameToServer);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.json({ status: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ status: false, message: "An error occurred while deleting the image" });
  }
};



const deleteProduct = async (req, res) => {
  const productId = req.query.id;
  
  if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
  }
  
  try {
      // Find and delete the product by its ID
      const product = await Product.findByIdAndDelete(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: 'Product not found' });
      }

      res.redirect('/admin/products'); // Redirect to the products management page or wherever you want
  } catch (err) {
      console.error(err);
      res.status(500).json({ status: false, message: 'Server Error' });
  }
}


module.exports = {
  getProductAddPage,
  saveImage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  deleteProduct




}
