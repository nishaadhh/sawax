const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("product-add", {
      cat: category,
    });
  } catch (error) {
    console.error("Error loading product add page:", error);
    res.status(500).json({ success: false, message: "Error loading product add page" });
  }
};

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

// Add Product with Multiple Image Upload (using Sharp)
const addProducts = async (req, res) => {
  try {
    // console.log("req.body", req.files);  
    const { productName, description, brand, regularPrice, quantity, color, category } = req.body;
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
    console.log("successful newProduct PHOTO", imageFilenames); 

    // Find category by name (ensure it exists)
    const foundCategory = await Category.findOne({ name: category });
    if (!foundCategory) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    // console.log("successful newProduct 2"); 

    // Create and save new product
    const newProduct = new Product({
      productName,
      description,
      brand,
      category: foundCategory._id,
      regularPrice: parseFloat(regularPrice),
      salePrice: parseFloat(regularPrice), 
      quantity: parseInt(quantity),
      color,
      productImage: imageFilenames,
      status: "available",
    });

    // Calculate sale price based on category offer
    newProduct.calculateSalePrice(foundCategory.categoryOffer);
    
    console.log("successful newProduct");  

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
    const limit = 7;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    })
      .sort({ _id: -1 }) // Sort by newest first (using _id which contains timestamp)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")
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
        error: null,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    } else {
      res.render("admin-error", {
        error: 'Categories not found.',
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("admin-error", {
      error: 'Failed to fetch products. Please try again later.',
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    
    // Validate percentage
    if (isNaN(percentage) || percentage < 1 || percentage > 99) {
      return res.status(400).json({ status: false, message: "Offer percentage must be between 1% and 99%" });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Update product offer
    product.productOffer = parseInt(percentage);
    
    // Recalculate sale price using the greater of product or category offer
    product.calculateSalePrice(product.category.categoryOffer);
    
    await product.save();

    res.json({ status: true, message: "Product offer added successfully" });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId).populate('category');

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Remove product offer
    product.productOffer = 0;
    
    // Recalculate sale price using only category offer
    product.calculateSalePrice(product.category.categoryOffer);
    
    await product.save();

    res.json({ status: true, message: "Product offer removed successfully" });
  } catch (error) {
    console.error("Error in removeProductOffer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id }).populate("category");
    const categories = await Category.find({});

    if (!product) {
      return res.status(404).send("Product not found");
    }

    res.render("product-edit", {
      product: product,
      cat: categories,
    });
  } catch (error) {
    console.error("Error in getEditProduct:", error);
    res.redirect("/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { 
      productName, description, regularPrice, 
      quantity, color, brand, category 
    } = req.body;

    
    const product = await Product.findById(id).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Ensure product has an image array with 4 slots
    while (product.productImage.length < 4) {
      product.productImage.push(null);
    }

    // Handle image updates - maintain exact positioning
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
        
        // Delete old image if it exists
        if (product.productImage[i-1]) {
          const oldImagePath = path.join(__dirname, "../../public", product.productImage[i-1]);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        // Set new image at the specific index
        product.productImage[i-1] = imagePath;
      }
    }

    // Remove any null values and ensure we have exactly the right images
    product.productImage = product.productImage.filter(img => img !== null);

    // Update product fields
    product.productName = productName;
    product.description = description;
    product.regularPrice = parseFloat(regularPrice);
    product.quantity = parseInt(quantity);
    product.color = color;
    product.brand = brand;

    // Find new category if changed
    const newCategory = await Category.findById(category);
    if (newCategory) {
      product.category = newCategory._id;
      // Recalculate sale price with new category offer
      if (typeof product.calculateSalePrice === 'function') {
        product.calculateSalePrice(newCategory.categoryOffer);
      }
    } else {
      // Keep existing category and recalculate
      if (typeof product.calculateSalePrice === 'function') {
        product.calculateSalePrice(product.category.categoryOffer);
      }
    }

    await product.save();
    res.redirect("/admin/products");

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

    // Find the image in the array and remove it
    const imagePathToDelete = product.productImage.find(img => img === imageNameToServer);
    if (imagePathToDelete) {
      // Remove from array
      product.productImage = product.productImage.filter(img => img !== imageNameToServer);
      await product.save();

      // Delete physical file
      const imagePath = path.join(__dirname, "../../public", imageNameToServer);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Image ${imageNameToServer} deleted successfully`);
      } else {
        console.log(`Image ${imageNameToServer} not found`);
      }
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

    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Server Error' });
  }
};


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
};