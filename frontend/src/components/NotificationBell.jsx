import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead } from "../api/client";

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const unreadCount = notifications.filter(n => !n.readAt).length;

    function getPersonLabel(person, fallback) {
        return person?.fullName || person?.email || fallback;
    }

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadNotifications() {
        try {
            const result = await getNotifications();
            setNotifications(result.notifications || []);
        } catch (err) {
            console.error("Failed to load notifications:", err);
        }
    }

    async function handleMarkRead(id) {
        await markNotificationRead(id);
        loadNotifications();
    }

    return (
        <div className="notification-bell">
            <button onClick={() => setShowDropdown(!showDropdown)} className="bell-button">
                🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>

            {showDropdown && (
                <div className="notification-dropdown">
                    {notifications.length === 0 ? (
                        <p className="no-notifications">No notifications</p>
                    ) : (
                        notifications.map(notif => (
                            <div key={notif.id} className={`notification-item ${!notif.readAt ? "unread" : ""}`}>
                                <div>
                                    <strong>{notif.title}</strong>
                                    <p>{notif.message}</p>
                                    <small>
                                        From {getPersonLabel(notif.sender, "System")} to {getPersonLabel(notif.receiver, "You")}
                                    </small>
                                    <small>{new Date(notif.scheduledAt).toLocaleString()}</small>
                                </div>
                                {!notif.readAt && (
                                    <button onClick={() => handleMarkRead(notif.id)}>Mark read</button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}