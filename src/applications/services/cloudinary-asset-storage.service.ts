import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export type CloudinaryResourceType = "image" | "raw" | "video" | "auto";

type UploadOptions = {
  folder: string;
  publicId: string;
  allowedFormats: string[];
};

const configurarCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
};

export const subirBufferCloudinary = (
  buffer: Buffer,
  options: UploadOptions,
): Promise<UploadApiResponse> => {
  configurarCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: options.folder,
        public_id: options.publicId,
        overwrite: false,
        unique_filename: false,
        allowed_formats: options.allowedFormats,
      },
      (error, resultado) => {
        if (error || !resultado) {
          reject(error ?? new Error("CLOUDINARY_EMPTY_RESPONSE"));
          return;
        }

        resolve(resultado);
      },
    );

    stream.end(buffer);
  });
};

export const eliminarAssetCloudinary = async (
  publicId: string,
  resourceType: string,
) => {
  configurarCloudinary();
  await cloudinary.uploader.destroy(publicId, {
    resource_type:
      resourceType === "raw" || resourceType === "video"
        ? resourceType
        : "image",
    invalidate: true,
  });
};
