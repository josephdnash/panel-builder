import { useState, useEffect } from 'react';
import { database } from '../utils/firebase';
import { ref, onValue, set } from 'firebase/database';

export default function AdminDashboard({ onClose }) {
    // --- RAW DATA STATES ---
    const [rawUsers, setRawUsers] = useState({});
    const [rawRoles, setRawRoles] = useState({});
    
    // --- PROCESSED UI STATES ---
    const [usersList, setUsersList] = useState([]);
    const [sharedProfiles, setSharedProfiles] = useState([]);
    
    // --- GLOBAL STATS ---
    const [statUsers, setStatUsers] = useState(0);
    const [statBeta, setStatBeta] = useState(0);
    const [statLayouts, setStatLayouts] = useState(0);

    // 1. Fetch Raw Users
    useEffect(() => {
        const usersRef = ref(database, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            setRawUsers(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch Raw Roles
    useEffect(() => {
        const rolesRef = ref(database, 'roles');
        const unsubscribe = onValue(rolesRef, (snapshot) => {
            setRawRoles(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

// 3. Combine Users and Roles into the Table Data
    useEffect(() => {
        let totalUsers = 0;
        let totalBeta = 0;
        let totalLayouts = 0;
        
        const formattedUsers = Object.keys(rawUsers).map(uid => {
            totalUsers++;
            const userData = rawUsers[uid];
            
            // Map the role from our rawRoles state, default to 'user'
            const userRole = rawRoles[uid] || 'user';
            if (userRole === 'beta') totalBeta++;
            
            let layoutCount = 0;
            let totalButtons = 0;
            
            // THE FIX: Use the user's active profiles as the source of truth, 
            // completely ignoring any orphaned "ghost" data in the layouts folder.
            if (userData.profiles) {
                const profileNames = Object.keys(userData.profiles);
                layoutCount = profileNames.length;
                totalLayouts += layoutCount;
                
                if (userData.layouts) {
                    profileNames.forEach(name => {
                        const pages = userData.layouts[name];
                        // Verify the layout exists and is an array before counting
                        if (pages && Array.isArray(pages)) {
                            pages.forEach(page => {
                                if (Array.isArray(page)) {
                                    page.forEach(cell => {
                                        if (cell && cell.id) totalButtons++;
                                    });
                                }
                            });
                        }
                    });
                }
            }

            let meanButtons = layoutCount > 0 ? (totalButtons / layoutCount).toFixed(1) : 0;
            const profiles = userData.profiles ? Object.keys(userData.profiles).join(", ") : "None";

            return {
                uid,
                email: userData.email || "Unknown (Requires Login)",
                role: userRole,
                layoutCount,
                meanButtons,
                profiles
            };
        });

        setUsersList(formattedUsers);
        setStatUsers(totalUsers);
        setStatBeta(totalBeta);
        setStatLayouts(totalLayouts);
    }, [rawUsers, rawRoles]);

    // 4. Fetch Shared Profiles
    useEffect(() => {
        const sharedRef = ref(database, 'efb_shared_profiles');
        const unsubscribe = onValue(sharedRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const formattedShared = Object.keys(data).map(code => ({
                    code,
                    aircraftTag: data[code].aircraftTag || "Unknown",
                    pageCount: data[code].layoutData ? data[code].layoutData.filter(page => page && page.some(cell => cell !== "")).length : 0
                }));
                setSharedProfiles(formattedShared);
            } else {
                setSharedProfiles([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- ACTION HANDLERS ---
    const handleRoleChange = async (uid, newRole) => {
        try {
            // Push the change to Firebase. 
            // The onValue listener above will catch it instantly and update the UI!
            await set(ref(database, `roles/${uid}`), newRole);
        } catch (e) {
            alert("Error updating role. Check your Firebase security rules.");
        }
    };

    const handleDeleteSharedProfile = async (code) => {
        if (window.confirm(`Are you sure you want to delete the shared profile [${code}]? This cannot be undone.`)) {
            await set(ref(database, `efb_shared_profiles/${code}`), null);
        }
    };

    // --- INLINE STYLES ---
    const statCardStyle = { background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', padding: '24px', borderRadius: '12px' };
    const statTitleStyle = { margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase' };
    const statValStyle = { fontSize: '36px', fontWeight: 800, color: 'var(--accent-blue)' };
    
    const thStyle = { background: '#000', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--border-panel)' };
    const tdStyle = { padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--border-panel)' };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--bg-base)', zIndex: 9999, padding: '40px', boxSizing: 'border-box', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-panel)', paddingBottom: '20px', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: 'white' }}>👑 Admin Dashboard</h1>
                <button onClick={onClose} style={{ background: '#27272a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ← Back to App
                </button>
            </div>

            {/* THE STATS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                <div style={statCardStyle}><h3 style={statTitleStyle}>Total Users</h3><div style={statValStyle}>{statUsers}</div></div>
                <div style={statCardStyle}><h3 style={statTitleStyle}>Beta Testers</h3><div style={statValStyle}>{statBeta}</div></div>
                <div style={statCardStyle}><h3 style={statTitleStyle}>Total Active Layouts</h3><div style={statValStyle}>{statLayouts}</div></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* THE USERS TABLE */}
                <div>
                    <h2 style={{ color: 'white', marginBottom: '16px' }}>User Management</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-panel)', borderRadius: '12px', overflow: 'hidden' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Email Address</th>
                                <th style={thStyle}>User ID</th>
                                <th style={thStyle}>Saved Layouts</th>
                                <th style={thStyle}>Avg Buttons</th>
                                <th style={thStyle}>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersList.length === 0 ? (
                                <tr><td colSpan="5" style={{...tdStyle, textAlign: 'center'}}>Loading user data...</td></tr>
                            ) : (
                                usersList.map(u => (
                                    <tr key={u.uid} style={{ transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#27272a'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{...tdStyle, fontWeight: 'bold'}}>{u.email}</td>
                                        <td style={{...tdStyle, fontFamily: '"Roboto Mono", monospace', color: 'var(--accent-green)', fontSize: '13px'}}>{u.uid}</td>
                                        <td style={tdStyle}>{u.layoutCount} <span style={{color: 'var(--text-muted)', fontSize: '12px'}}>(Profiles: {u.profiles})</span></td>
                                        <td style={tdStyle}>{u.meanButtons}</td>
                                        <td style={tdStyle}>
                                            <select 
                                                value={u.role} 
                                                onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                                style={{ background: '#000', color: 'white', border: '1px solid #333', padding: '8px', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="user">User</option>
                                                <option value="beta">Beta Tester</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* THE SHARED PROFILES MANAGER */}
                <div>
                    <h2 style={{ color: 'white', marginBottom: '16px' }}>Shared Profiles Moderation</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-panel)', borderRadius: '12px', overflow: 'hidden' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Share Code</th>
                                <th style={thStyle}>Aircraft Tag</th>
                                <th style={thStyle}>Pages Used</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sharedProfiles.length === 0 ? (
                                <tr><td colSpan="4" style={{...tdStyle, textAlign: 'center'}}>No shared profiles currently active.</td></tr>
                            ) : (
                                sharedProfiles.map(profile => (
                                    <tr key={profile.code} style={{ transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#27272a'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{...tdStyle, fontWeight: 'bold', color: 'var(--accent-yellow)', fontSize: '16px', letterSpacing: '1px'}}>{profile.code}</td>
                                        <td style={tdStyle}>{profile.aircraftTag}</td>
                                        <td style={tdStyle}>{profile.pageCount}</td>
                                        <td style={tdStyle}>
                                            <button 
                                                onClick={() => handleDeleteSharedProfile(profile.code)}
                                                style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}