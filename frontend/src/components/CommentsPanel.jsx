// CommentsPanel.jsx
import { useState, useEffect } from "react";
import { getComments, addComment } from "../api/client";

export default function CommentsPanel({ podId, postId, currentUserId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadComments();
  }, [postId, page]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const result = await getComments(podId, postId, page);
      if (page === 1) {
        setComments(result.comments || []);
      } else {
        setComments(prev => [...prev, ...(result.comments || [])]);
      }
      setHasMore(result.hasMore || false);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const result = await addComment(podId, postId, newComment.trim());
      setComments(prev => [result.comment, ...prev]);
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="comments-panel">
      <form onSubmit={handleSubmitComment} className="comment-form">
        <div className="comment-input-wrapper">
          <div className="comment-avatar">
            <span>{currentUserId?.charAt(0) || "U"}</span>
          </div>
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="comment-input"
          />
          <button type="submit" disabled={submitting || !newComment.trim()} className="comment-submit">
            Post
          </button>
        </div>
      </form>

      <div className="comments-list">
        {loading && page === 1 ? (
          <div className="comments-loading">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">No comments yet. Be the first to comment!</div>
        ) : (
          <>
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar">
                  {comment.author?.avatarImageUrl ? (
                    <img src={comment.author.avatarImageUrl} alt="" />
                  ) : (
                    <span>{comment.author?.fullName?.[0] || comment.author?.email?.[0] || "U"}</span>
                  )}
                </div>
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">{comment.author?.fullName || comment.author?.email}</span>
                    <span className="comment-time">{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="comment-text">{comment.content}</p>
                  {comment.likeCount > 0 && (
                    <div className="comment-stats">
                      <span>❤️ {comment.likeCount}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <button className="load-more-comments" onClick={() => setPage(p => p + 1)}>
                Load more comments
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}