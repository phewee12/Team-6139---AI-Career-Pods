// src/components/PostCard.jsx
import { useState } from 'react';
import { getComments, addComment } from '../api/client';

export default function PostCard({ post, currentUser, onLike, onShare, podId }) {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    const [showFullContent, setShowFullContent] = useState(false);

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = {
            year: 31536000, month: 2592000, week: 604800,
            day: 86400, hour: 3600, minute: 60
        };
        
        for (let [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
        return 'just now';
    };

    const loadComments = async () => {
        if (comments.length > 0) {
            setShowComments(!showComments);
            return;
        }
        
        try {
            const result = await getComments(podId, post.id);
            setComments(result.comments);
            setShowComments(true);
        } catch (error) {
            console.error('Failed to load comments:', error);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        
        setCommentLoading(true);
        try {
            const result = await addComment(podId, post.id, commentText);
            setComments(prev => [...prev, result.comment]);
            setCommentText('');
        } catch (error) {
            console.error('Failed to add comment:', error);
        } finally {
            setCommentLoading(false);
        }
    };

    const truncateText = (text, maxLength = 200) => {
        if (text.length <= maxLength || showFullContent) return text;
        return text.substring(0, maxLength) + '...';
    };

    return (
        <article className="social-post-card">
            {/* Post Header */}
            <div className="post-header-social">
                <div className="post-author-info">
                    <div className="post-author-avatar">
                        {post.authorAvatar ? (
                            <img src={post.authorAvatar} alt={post.authorName} />
                        ) : (
                            <span>{post.authorName?.charAt(0) || 'U'}</span>
                        )}
                    </div>
                    <div className="post-author-details">
                        <span className="post-author-name">{post.authorName}</span>
                        <span className="post-timestamp">{timeAgo(post.createdAt)}</span>
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

            {/* Post Title */}
            <h3 className="post-title">{post.title}</h3>
            
            {/* Post Content */}
            <p className="post-content">
                {truncateText(post.content)}
                {post.content.length > 200 && !showFullContent && (
                    <button 
                        className="read-more-btn"
                        onClick={() => setShowFullContent(true)}
                    >
                        Read more
                    </button>
                )}
            </p>

            {/* Post Media (if any) */}
            {post.mediaUrl && (
                <div className="post-media">
                    {post.mediaUrl.match(/\.(jpeg|jpg|gif|png)$/) ? (
                        <img src={post.mediaUrl} alt="Post attachment" />
                    ) : post.mediaUrl.match(/\.(mp4|webm)$/) ? (
                        <video src={post.mediaUrl} controls />
                    ) : null}
                </div>
            )}

            {/* Post Stats */}
            <div className="post-stats">
                <span>❤️ {post.likes || 0} likes</span>
                <span>💬 {post.commentCount || 0} comments</span>
                <span>🔄 {post.shares || 0} shares</span>
            </div>

            {/* Action Buttons */}
            <div className="post-actions-social">
                <button 
                    className={`action-btn ${post.isLikedByCurrentUser ? 'liked' : ''}`}
                    onClick={onLike}
                >
                    <span>{post.isLikedByCurrentUser ? '❤️' : '🤍'}</span>
                    <span>{post.isLikedByCurrentUser ? 'Liked' : 'Like'}</span>
                </button>
                
                <button className="action-btn" onClick={loadComments}>
                    <span>💬</span>
                    <span>Comment</span>
                </button>
                
                <button className="action-btn" onClick={onShare}>
                    <span>🔄</span>
                    <span>Share</span>
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="comments-section">
                    {/* Comment Form */}
                    <form onSubmit={handleAddComment} className="comment-form">
                        <div className="comment-avatar">
                            {currentUser?.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt={currentUser.fullName} />
                            ) : (
                                <span>{currentUser?.fullName?.charAt(0) || 'U'}</span>
                            )}
                        </div>
                        <div className="comment-input-wrapper">
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Write a comment..."
                                className="comment-input"
                            />
                            <button type="submit" disabled={commentLoading || !commentText.trim()}>
                                Post
                            </button>
                        </div>
                    </form>

                    {/* Comments List */}
                    <div className="comments-list">
                        {comments.map(comment => (
                            <div key={comment.id} className="comment-item">
                                <div className="comment-avatar">
                                    {comment.userAvatar ? (
                                        <img src={comment.userAvatar} alt={comment.userName} />
                                    ) : (
                                        <span>{comment.userName?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                                <div className="comment-content">
                                    <div className="comment-header">
                                        <span className="comment-author">{comment.userName}</span>
                                        <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                                    </div>
                                    <p className="comment-text">{comment.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </article>
    );
}