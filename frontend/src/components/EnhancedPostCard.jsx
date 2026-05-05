// EnhancedPostCard.jsx - Fixed version with proper error handling
import { useState } from "react";
import { likePost, unlikePost, savePost, unsavePost } from "../api/client";

export default function EnhancedPostCard({ post, podId, currentUserId, onPostUpdate }) {
  const [liked, setLiked] = useState(post.isLikedByCurrentUser || false);
  const [saved, setSaved] = useState(post.isSavedByCurrentUser || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [saveCount, setSaveCount] = useState(post.saveCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [optimisticLike, setOptimisticLike] = useState(false);
  const [optimisticSave, setOptimisticSave] = useState(false);
  const [error, setError] = useState(null);

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleLike = async () => {
    if (optimisticLike) return;
    
    console.log("Toggling like for post:", post.id);
    setOptimisticLike(true);
    setError(null);
    
    const wasLiked = liked;
    const oldLikeCount = likeCount;
    
    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        console.log("Sending unlike request...");
        await unlikePost(podId, post.id);
        console.log("Unlike successful");
      } else {
        console.log("Sending like request...");
        await likePost(podId, post.id);
        console.log("Like successful");
      }
      if (onPostUpdate) onPostUpdate();
    } catch (error) {
      console.error("Failed to toggle like:", error);
      // Rollback on error
      setLiked(wasLiked);
      setLikeCount(oldLikeCount);
      setError(error.message || "Failed to update like");
    } finally {
      setOptimisticLike(false);
    }
  };

  const handleSave = async () => {
    if (optimisticSave) return;
    
    console.log("Toggling save for post:", post.id);
    setOptimisticSave(true);
    setError(null);
    
    const wasSaved = saved;
    const oldSaveCount = saveCount;
    
    // Optimistic update
    setSaved(!wasSaved);
    setSaveCount(prev => wasSaved ? prev - 1 : prev + 1);

    try {
      if (wasSaved) {
        console.log("Sending unsave request...");
        await unsavePost(podId, post.id);
        console.log("Unsave successful");
      } else {
        console.log("Sending save request...");
        await savePost(podId, post.id);
        console.log("Save successful");
      }
      if (onPostUpdate) onPostUpdate();
    } catch (error) {
      console.error("Failed to toggle save:", error);
      // Rollback on error
      setSaved(wasSaved);
      setSaveCount(oldSaveCount);
      setError(error.message || "Failed to update save");
    } finally {
      setOptimisticSave(false);
    }
  };

  return (
    <article className="enhanced-post-card">
      {/* Error message if any */}
      {error && (
        <div className="error-banner" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Post Header */}
      <div className="post-header-enhanced">
        <div className="post-author-info">
          <div className="post-avatar">
            {post.author?.avatarImageUrl ? (
              <img src={post.author.avatarImageUrl} alt="" />
            ) : (
              <span>{post.author?.fullName?.[0] || post.author?.email?.[0] || "U"}</span>
            )}
          </div>
          <div className="post-author-details">
            <span className="post-author-name">{post.author?.fullName || post.author?.email || "Anonymous"}</span>
            <span className="post-timestamp">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="post-tags">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="post-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="post-content-enhanced">
        {post.title && <h3 className="post-title">{post.title}</h3>}
        <p className="post-text">{post.content}</p>
        {post.mediaUrl && (
          <div className="post-media">
            {post.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img src={post.mediaUrl} alt="Post media" loading="lazy" />
            ) : post.mediaUrl.match(/\.(mp4|webm)$/i) ? (
              <video src={post.mediaUrl} controls />
            ) : null}
          </div>
        )}
      </div>

      {/* Engagement Bar */}
      <div className="post-engagement-bar">
        <div className="engagement-stats">
          <button 
            className={`engagement-btn like-btn ${liked ? "active" : ""}`}
            onClick={handleLike}
            disabled={optimisticLike}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{formatCount(likeCount)}</span>
          </button>

          <button 
            className="engagement-btn comment-btn"
            onClick={() => setShowComments(!showComments)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{formatCount(post.commentCount || 0)}</span>
          </button>

          <button 
            className={`engagement-btn save-btn ${saved ? "active" : ""}`}
            onClick={handleSave}
            disabled={optimisticSave}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{formatCount(saveCount)}</span>
          </button>
        </div>
      </div>

      {/* Comments Section (expandable) */}
      {showComments && (
        <div className="comments-section">
          <CommentsPanel podId={podId} postId={post.id} currentUserId={currentUserId} />
        </div>
      )}
    </article>
  );
}