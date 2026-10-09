export const DEFAULT_PHOTO_LAYOUT = Object.freeze({
  fit: 'contain',
  zoom: 1,
  positionX: 0.5,
  positionY: 0.5,
});

export const PHOTO_FRAME_SIZE = Object.freeze({ width: 1120, height: 700 });
const MAX_IMAGE_PIXELS = 35_000_000;

export function normalizePhotoLayout(layout = {}) {
  const fit = layout.fit === 'cover' ? 'cover' : 'contain';
  const zoomValue = Number(layout.zoom);
  const positionXValue = Number(layout.positionX);
  const positionYValue = Number(layout.positionY);
  return {
    fit,
    zoom: Number.isFinite(zoomValue) ? Math.max(0.7, Math.min(2.5, zoomValue)) : DEFAULT_PHOTO_LAYOUT.zoom,
    positionX: Number.isFinite(positionXValue) ? Math.max(0, Math.min(1, positionXValue)) : DEFAULT_PHOTO_LAYOUT.positionX,
    positionY: Number.isFinite(positionYValue) ? Math.max(0, Math.min(1, positionYValue)) : DEFAULT_PHOTO_LAYOUT.positionY,
  };
}

export function getPhotoPlacement(sourceWidth, sourceHeight, frameWidth, frameHeight, settings = DEFAULT_PHOTO_LAYOUT) {
  const layout = normalizePhotoLayout(settings);
  if (!(sourceWidth > 0 && sourceHeight > 0 && frameWidth > 0 && frameHeight > 0)) {
    return { x: 0, y: 0, width: 0, height: 0, layout };
  }
  const widthScale = frameWidth / sourceWidth;
  const heightScale = frameHeight / sourceHeight;
  const baseScale = layout.fit === 'cover' ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale);
  const scale = baseScale * layout.zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = (frameWidth - width) * layout.positionX;
  const y = (frameHeight - height) * layout.positionY;
  return {
    x: Math.abs(x) < Number.EPSILON ? 0 : x,
    y: Math.abs(y) < Number.EPSILON ? 0 : y,
    width,
    height,
    layout,
  };
}

export async function prepareKtpImageAssets(file) {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  validateDimensions(width, height);
  const photoData = encodePhotoPreview(image, width, height);
  try {
    const ocrVariants = createEnhancedOcrVariants(image, width, height);
    return { photoData, enhancedData: ocrVariants.enhancedData, thresholdData: ocrVariants.thresholdData };
  } catch {
    // Keep the original photo usable even on browsers that cannot allocate the enhancement canvas.
    return { photoData, enhancedData: '', thresholdData: '' };
  }
}

export async function prepareKtpPhoto(file) {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  validateDimensions(width, height);
  return encodePhotoPreview(image, width, height);
}

export async function prepareOcrVariantsFromDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  validateDimensions(width, height);
  return createEnhancedOcrVariants(image, width, height);
}

export async function composePositionedPhoto(sourceDataUrl, settings = DEFAULT_PHOTO_LAYOUT) {
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_FRAME_SIZE.width;
  canvas.height = PHOTO_FRAME_SIZE.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Browser tidak dapat menyimpan tata letak foto.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawPositionedImage(context, image, canvas.width, canvas.height, settings);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function drawPositionedImage(context, image, frameWidth, frameHeight, settings = DEFAULT_PHOTO_LAYOUT) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const placement = getPhotoPlacement(sourceWidth, sourceHeight, frameWidth, frameHeight, settings);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, frameWidth, frameHeight);
  context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  return placement;
}

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const isBlob = typeof Blob !== 'undefined' && source instanceof Blob;
    const sourceUrl = isBlob ? URL.createObjectURL(source) : String(source || '');
    const image = new Image();
    image.onload = () => {
      if (isBlob) URL.revokeObjectURL(sourceUrl);
      resolve(image);
    };
    image.onerror = () => {
      if (isBlob) URL.revokeObjectURL(sourceUrl);
      reject(new Error('Foto tidak dapat dibuka. Pastikan file gambarnya masih utuh.'));
    };
    image.src = sourceUrl;
  });
}

function validateDimensions(width, height) {
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('Resolusi foto terlalu besar. Coba perkecil gambar lalu unggah kembali.');
  }
}

function encodePhotoPreview(image, width, height) {
  const photoScale = Math.min(1, 1400 / width, 900 / height);
  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = Math.max(1, Math.round(width * photoScale));
  photoCanvas.height = Math.max(1, Math.round(height * photoScale));
  const photoContext = photoCanvas.getContext('2d', { alpha: false });
  if (!photoContext) throw new Error('Browser tidak dapat menyiapkan foto KTP.');
  photoContext.fillStyle = '#ffffff';
  photoContext.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
  photoContext.drawImage(image, 0, 0, photoCanvas.width, photoCanvas.height);
  return photoCanvas.toDataURL('image/jpeg', 0.86);
}

function createEnhancedOcrVariants(image, sourceWidth, sourceHeight) {
  const scale = Math.min(2, 2400 / sourceWidth, 1600 / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Browser tidak dapat meningkatkan kontras foto KTP.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const grayscale = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  const pixels = imageData.data;
  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const gray = Math.round(pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114);
    grayscale[pixel] = gray;
    histogram[gray] += 1;
  }

  const lower = percentileFromHistogram(histogram, grayscale.length, 0.025);
  const upper = percentileFromHistogram(histogram, grayscale.length, 0.975);
  const range = Math.max(1, upper - lower);
  const enhancedGray = new Uint8Array(grayscale.length);
  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const value = clampByte(((grayscale[pixel] - lower) / range) * 255);
    enhancedGray[pixel] = value;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  const enhancedData = canvas.toDataURL('image/jpeg', 0.92);

  const thresholdData = makeThresholdVariant(enhancedGray, width, height);
  return { enhancedData, thresholdData };
}

function percentileFromHistogram(histogram, count, percentile) {
  const target = count * percentile;
  let accumulated = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= target) return value;
  }
  return 255;
}

function makeThresholdVariant(grayscale, width, height) {
  const threshold = otsuThreshold(grayscale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const imageData = context.createImageData(width, height);
  const pixels = imageData.data;
  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const value = grayscale[pixel] < threshold ? 0 : 255;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function otsuThreshold(grayscale) {
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (const value of grayscale) {
    histogram[value] += 1;
    sum += value;
  }
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let maxVariance = -1;
  let bestThreshold = 128;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value];
    if (!backgroundWeight) continue;
    const foregroundWeight = grayscale.length - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = value;
    }
  }
  return bestThreshold;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
