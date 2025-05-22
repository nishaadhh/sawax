// Image handling and cropping functionality
let croppers = {};

function previewImage(event, index) {
    const input = event.target;
    const preview = document.getElementById(`preview${index}`);
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validate file
        const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validImageTypes.includes(file.type)) {
            Swal.fire({
                title: 'Invalid File!',
                text: 'Please select a valid image file (JPEG, PNG, GIF, or WebP)',
                icon: 'error'
            });
            input.value = '';
            return;
        }

        if (file.size > maxSize) {
            Swal.fire({
                title: 'File Too Large!',
                text: 'Image file size must be less than 5MB',
                icon: 'error'
            });
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            // Destroy existing cropper if any
            if (croppers[index]) {
                croppers[index].destroy();
                delete croppers[index];
            }

            // Show preview
            preview.src = e.target.result;
            preview.style.display = 'block';

            // Initialize Cropper
            croppers[index] = new Cropper(preview, {
                aspectRatio: 1,
                viewMode: 2,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                modal: true,
                guides: true,
                highlight: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                ready: function() {
                    this.cropper.crop();
                }
            });
        };
        reader.readAsDataURL(file);
    }
}

function getCroppedImageBlob(index) {
    return new Promise((resolve, reject) => {
        if (!croppers[index]) {
            resolve(null);
            return;
        }

        croppers[index].getCroppedCanvas({
            width: 800,
            height: 800,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        }).toBlob(
            (blob) => {
                resolve(blob);
            },
            'image/webp',
            0.8
        );
    });
}

// Handle form submission with cropped images
async function handleFormSubmit(formElement, isEdit = false) {
    const formData = new FormData(formElement);
    
    // Process cropped images
    for (let i = 0; i < 4; i++) {
        const croppedBlob = await getCroppedImageBlob(i);
        if (croppedBlob) {
            formData.set(`image${i + 1}`, croppedBlob, `image${i + 1}.webp`);
        }
    }

    try {
        const response = await fetch(formElement.action, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: isEdit ? 'Product updated successfully' : 'Product added successfully',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = isEdit ? '/admin/products' : '/admin/addProducts';
                }
            });
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'An error occurred',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'An unexpected error occurred',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}