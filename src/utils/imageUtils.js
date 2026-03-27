const MAX_FILE_SIZE = 300 * 1024; // 300 KB roughly for WebP

export const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimension
                const MAX_DIM = 1200;
                if (width > height && width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                } else if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to WebP
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size > MAX_FILE_SIZE && quality > 0.1) {
                            quality -= 0.1;
                            tryCompress();
                        } else {
                            resolve(blob);
                        }
                    }, 'image/webp', quality);
                };

                tryCompress();
            };
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const uploadToCloudinary = async (blob) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset';

    // Mock upload for demo mode
    if (cloudName === 'demo' || uploadPreset === 'unsigned_preset') {
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTimeout(() => {
                    res({
                        id: Math.random().toString(36).substr(2, 9),
                        url: reader.result,
                        name: 'receipt.webp',
                        size: blob.size
                    });
                }, 1000);
            };
            reader.onerror = rej;
            reader.readAsDataURL(blob);
        });
    }

    const formData = new FormData();
    formData.append('file', blob, 'receipt.webp');
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'jjledger');

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (data.secure_url) {
            return {
                id: data.public_id,
                url: data.secure_url,
                name: data.original_filename || 'receipt.webp',
                size: data.bytes
            };
        }
        throw new Error(data.error?.message || 'Upload failed');
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw error;
    }
};
