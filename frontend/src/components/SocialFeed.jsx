// src/components/SocialFeed.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { getFeedPosts, likePost, unlikePost, sharePost } from '../api/client';
import PostCard from './PostCard';
import CreatePost from './CreatePost';

export default function SocialFeed({ podId, currentUser }) {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('recent');
    const observerRef = useRef();
    const lastPostRef = useRef();

    const loadPosts = useCallback(async (reset = false) => {
        if (loading) return;
        setLoading(true);
        
        try {
            const currentPage = reset ? 1 : page;
            const result = await getFeedPosts(podId, {
                sort: sortBy,
                page: currentPage,
                limit: 10
            });
            
            if (reset) {
                setPosts(result.posts);
                setPage(2);
            } else {
                setPosts(prev => [...prev, ...result.posts]);
                setPage(prev => prev + 1);
            }
            
            setHasMore(result.hasMore);
        } catch (error) {
            console.error('Failed to load feed:', error);
        } finally {
            setLoading(false);
        }
    }, [podId, sortBy, page, loading]);

    useEffect(() => {
        setPosts([]);
        setPage(1);
        setHasMore(true);
        loadPosts(true);
    }, [sortBy]);

    useEffect(() => {
        if (loading) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadPosts();
                }
            },
            { threshold: 0.1 }
        );
        
        if (lastPostRef.current) {
            observer.observe(lastPostRef.current);
        }
        
        return () => observer.disconnect();
    }, [loading, hasMore, loadPosts]);

    const handleLike = async (postId, isLiked) => {
        try {
            if (isLiked) {
                await unlikePost(podId, postId);
            } else {
                await likePost(podId, postId);
            }
            
            setPosts(prev => prev.map(post => 
                post.id === postId 
                    ? { 
                        ...post, 
                        likes: isLiked ? post.likes - 1 : post.likes + 1,
                        isLikedByCurrentUser: !isLiked 
                    }
                    : post
            ));
        } catch (error) {
            console.error('Failed to toggle like:', error);
        }
    };

    const handleShare = async (postId) => {
        try {
            await sharePost(podId, postId);
            setPosts(prev => prev.map(post => 
                post.id === postId 
                    ? { ...post, shares: (post.shares || 0) + 1 }
                    : post
            ));
        } catch (error) {
            console.error('Failed to share:', error);
        }
    };

    const handlePostCreated = (newPost) => {
        setPosts(prev => [newPost, ...prev]);
    };

    return (
        <div className="social-feed-container">
            {/* Sort Tabs */}
            <div className="feed-sort-tabs">
                <button 
                    className={`sort-tab ${sortBy === 'recent' ? 'active' : ''}`}
                    onClick={() => setSortBy('recent')}
                >
                    📅 Recent
                </button>
                <button 
                    className={`sort-tab ${sortBy === 'popular' ? 'active' : ''}`}
                    onClick={() => setSortBy('popular')}
                >
                    🔥 Most Liked
                </button>
            </div>

            {/* Create Post Component */}
            <CreatePost 
                podId={podId} 
                currentUser={currentUser}
                onPostCreated={handlePostCreated}
            />

            {/* Posts Feed */}
            <div className="posts-feed">
                {posts.length === 0 && !loading ? (
                    <div className="empty-feed-card">
                        <p>✨ No posts yet</p>
                        <p className="helper-copy">Be the first to share something with your pod!</p>
                    </div>
                ) : (
                    posts.map((post, index) => (
                        <div 
                            key={post.id} 
                            ref={index === posts.length - 1 ? lastPostRef : null}
                        >
                            <PostCard
                                post={post}
                                currentUser={currentUser}
                                onLike={() => handleLike(post.id, post.isLikedByCurrentUser)}
                                onShare={() => handleShare(post.id)}
                                podId={podId}
                            />
                        </div>
                    ))
                )}
                
                {loading && (
                    <div className="loading-skeleton">
                        <div className="skeleton-card"></div>
                        <div className="skeleton-card"></div>
                    </div>
                )}
                
                {!hasMore && posts.length > 0 && (
                    <p className="helper-copy end-of-feed">🎉 You've seen everything! Check back later for more.</p>
                )}
            </div>
        </div>
    );
}