// Photo (many) and video (one) upload for a product.
import { useState } from 'react';
import { uploadPhotos, uploadVideo } from '../../api/assets.api';
import Message from './Message';

export default function MediaUploader({ asset, onUpdated, maxPhotoMB = 8, maxVideoMB = 25 }) {
  const [photos, setPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const locked = asset.Status === 'Sold';

  const send = async (fn, done) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fn();
      setMessage({ type: 'success', text: done });
      onUpdated?.(updated);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const tooBig = (files, mb) => Array.from(files).find((f) => f.size > mb * 1024 * 1024);

  const onPhotos = async (e) => {
    e.preventDefault();
    const big = tooBig(photos, maxPhotoMB);
    if (big) return setMessage({ type: 'error', text: `${big.name} is larger than ${maxPhotoMB} MB` });
    await send(() => uploadPhotos(asset.AssetID, photos), `${photos.length} photo(s) uploaded`);
    setPhotos([]);
    e.target.reset();
  };

  const onVideo = async (e) => {
    e.preventDefault();
    if (video && video.size > maxVideoMB * 1024 * 1024) return setMessage({ type: 'error', text: `Video is larger than ${maxVideoMB} MB` });
    await send(() => uploadVideo(asset.AssetID, video), 'Video uploaded');
    setVideo(null);
    e.target.reset();
  };

  return (
    <div className="media">
      <Message message={message} onClose={() => setMessage(null)} />
      {asset.PhotoLinks?.length > 0 && (
        <div className="thumbs">
          {asset.PhotoLinks.map((link) => (
            <a key={link} href={link} target="_blank" rel="noreferrer"><img src={link} alt={asset.ItemName} /></a>
          ))}
        </div>
      )}
      {asset.VideoLink && (
        <p><a href={asset.VideoLink} target="_blank" rel="noreferrer">▶ View current video</a></p>
      )}
      {!locked && (
        <div className="media-forms">
          <form onSubmit={onPhotos}>
            <label className="field">
              <span>Photos (max {maxPhotoMB} MB each)</span>
              <input type="file" accept="image/*" multiple onChange={(e) => setPhotos(e.target.files)} />
            </label>
            <button className="btn btn-secondary" disabled={busy || !photos.length}>{busy ? 'Uploading…' : 'Upload photos'}</button>
          </form>
          <form onSubmit={onVideo}>
            <label className="field">
              <span>Video (one per product, max {maxVideoMB} MB)</span>
              <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files[0] || null)} />
            </label>
            <button className="btn btn-secondary" disabled={busy || !video}>{busy ? 'Uploading…' : asset.VideoLink ? 'Replace video' : 'Upload video'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
