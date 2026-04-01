import { useState, useEffect } from 'react';
import { auth, database } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, get, onValue } from 'firebase/database';

import AuthScreen from './components/AuthScreen';
import PinScreen from './components/PinScreen';
import TopBar from './components/TopBar';
import Grid from './components/Grid';
import ComponentModal from './components/ComponentModal';
import SettingsModal from './components/SettingsModal';
import CellSettingsModal from './components/CellSettingsModal';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';

import useMSFS from './hooks/useMSFS';

// --- MOBILE DRAG & DROP POLYFILL ---
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css"; 

polyfill({
    holdToDrag: 100 
});

window.addEventListener('touchmove', function() {}, {passive: false});
// -----------------------------------

function App() {
    // --- AUTH STATES ---
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // --- APP & PAIRING STATES ---
    const [userPin, setUserPin] = useState(localStorage.getItem("efb_pairing_pin") || null);
    const [isPairing, setIsPairing] = useState(false);
    const [isEditMode, setIsEditMode] = useState(true);
    
    // --- PERSISTENT ROUTING STATES ---
    const [currentProfile, setCurrentProfile] = useState(localStorage.getItem("efb_current_profile") || "Default");
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("efb_current_page")) || 0);

    // --- UI THEME STATE ---
    let initialTheme = localStorage.getItem('efb_theme') || 'modern';
    if (initialTheme === 'retro' || initialTheme === '3d-experimental') initialTheme = 'retro-green';
    const [theme, setTheme] = useState(initialTheme);

    // --- MODAL STATES ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCellSettingsOpen, setIsCellSettingsOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [selectedCellIndex, setSelectedCellIndex] = useState(null);

    // --- DATA STATES ---
    const [availableProfiles, setAvailableProfiles] = useState({});
    const [customComponents, setCustomComponents] = useState({});
    const [pagesData, setPagesData] = useState(
        new Array(10).fill(null).map(() => new Array(24).fill(""))
    );

    // --- WEBSOCKET ENGINE ---
    const { simState, connectionStatus, sendCommand } = useMSFS(userPin, pagesData);

   // --- THEME SIDE EFFECT ---
    useEffect(() => {
        localStorage.setItem('efb_theme', theme);
        
        // Strip ALL possible theme classes before applying the new one
        document.body.classList.remove('theme-retro', 'theme-retro-green', 'theme-retro-blue', 'theme-retro-amber');
        
        if (theme === 'retro-green') {
            document.body.classList.add('theme-retro', 'theme-retro-green');
        } else if (theme === 'retro-blue') {
            document.body.classList.add('theme-retro', 'theme-retro-blue');
        } else if (theme === 'retro-amber') {
            document.body.classList.add('theme-retro', 'theme-retro-amber');
        }
    }, [theme]);

    const themes = ['modern', 'retro-green', 'retro-blue', 'retro-amber'];
    const cycleTheme = (direction) => {
        setTheme(prev => {
            let currentIndex = themes.indexOf(prev);
            if (currentIndex === -1) currentIndex = 0;
            if (direction === 'next') return themes[(currentIndex + 1) % themes.length];
            return themes[(currentIndex - 1 + themes.length) % themes.length];
        });
    };

    // --- MODE SIDE EFFECT (SAFE CLASS TOGGLE) ---
    useEffect(() => {
        if (isEditMode) {
            document.body.classList.add('edit-mode');
            document.body.classList.remove('fly-mode');
        } else {
            document.body.classList.add('fly-mode');
            document.body.classList.remove('edit-mode');
        }
    }, [isEditMode]);

    // Watch for a successful pairing connection
    useEffect(() => {
        if (isPairing && connectionStatus === 'connected') {
            localStorage.setItem("efb_pairing_pin", userPin);
            setIsPairing(false); 
        }
    }, [isPairing, connectionStatus, userPin]);

    // Persist Profile and Page across refreshes
    useEffect(() => {
        localStorage.setItem("efb_current_profile", currentProfile);
        localStorage.setItem("efb_current_page", currentPage.toString());
    }, [currentProfile, currentPage]);

    // --- 1. FIREBASE AUTHENTICATION ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await set(ref(database, `users/${currentUser.uid}/email`), currentUser.email);
                const roleSnap = await get(ref(database, `roles/${currentUser.uid}`));
                setIsAdmin(roleSnap.val() === 'admin');
            } else {
                setUser(null);
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- 2. FIREBASE PROFILE METADATA SYNC ---
    useEffect(() => {
        if (!user) return;
        const profilesRef = ref(database, `users/${user.uid}/profiles`);
        const unsubscribe = onValue(profilesRef, (snapshot) => {
            if (snapshot.exists()) {
                setAvailableProfiles(snapshot.val());
            } else {
                const defaultProfile = { Default: { name: "Default", aircraftTag: "Global" } };
                set(profilesRef, defaultProfile);
                setAvailableProfiles(defaultProfile);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // --- 3. FIREBASE LAYOUT DATA SYNC ---
    useEffect(() => {
        if (!user || !currentProfile) return;
        const layoutRef = ref(database, `users/${user.uid}/layouts/${currentProfile}`);
        const unsubscribe = onValue(layoutRef, (snapshot) => {
            const data = snapshot.val();
            let safePages = new Array(10).fill(null).map(() => new Array(24).fill(""));
            if (data) {
                for (let p = 0; p < 10; p++) {
                    if (data[p]) {
                        Object.keys(data[p]).forEach(key => {
                            let index = parseInt(key);
                            if (!isNaN(index) && index >= 0 && index < 24) safePages[p][index] = data[p][key] || "";
                        });
                    }
                }
            }
            setPagesData(safePages);
        });
        return () => unsubscribe();
    }, [user, currentProfile]);

    // --- 4. FIREBASE CUSTOM COMPONENT SYNC ---
    useEffect(() => {
        if (!user) return;
        const customRef = ref(database, `users/${user.uid}/customComponents`);
        const unsubscribe = onValue(customRef, (snapshot) => {
            if (snapshot.exists()) setCustomComponents(snapshot.val());
            else setCustomComponents({});
        });
        return () => unsubscribe();
    }, [user]);

    const saveLayoutToCloud = (newLayoutData) => {
        if (user && currentProfile) {
            set(ref(database, `users/${user.uid}/layouts/${currentProfile}`), newLayoutData).catch(e => console.error(e));
        }
    };

    // --- GRID INTERACTION HANDLERS ---
    const handleCellClick = (index) => {
        if (isEditMode) {
            setSelectedCellIndex(index);
            const cellData = pagesData[currentPage][index];
            
            if (cellData && cellData.id) {
                const isCustomizable = 
                    (cellData.id && cellData.id.includes('custom')) || 
                    (cellData.baseType && cellData.baseType.includes('custom')) ||
                    (cellData.id && cellData.id.includes('folder')) ||
                    (cellData.baseType && cellData.baseType.includes('folder')) ||
                    (cellData.id === 'smart_toggle') ||
                    (cellData.baseType === 'smart_toggle');

                if (isCustomizable) {
                    setIsCellSettingsOpen(true);
                }
            } else {
                setIsModalOpen(true);
            }
        }
    };

    const handleDeleteCell = (index) => {
        const cellData = pagesData[currentPage][index];
        const newPagesData = [...pagesData];

        if (cellData && cellData.targetPage) {
            if (window.confirm(`Delete folder "${cellData.label}"? This will also wipe all buttons inside that folder.`)) {
                newPagesData[cellData.targetPage] = new Array(24).fill(""); 
            } else {
                return; 
            }
        }

        newPagesData[currentPage][index] = ""; 
        setPagesData(newPagesData);
        saveLayoutToCloud(newPagesData);
    };

    const handleDropCell = (sourceIndex, targetIndex) => {
        if (sourceIndex === targetIndex) return; 
        const newPagesData = [...pagesData];
        const currentPageData = [...newPagesData[currentPage]];
        
        const temp = currentPageData[sourceIndex];
        currentPageData[sourceIndex] = currentPageData[targetIndex];
        currentPageData[targetIndex] = temp;

        newPagesData[currentPage] = currentPageData;
        setPagesData(newPagesData);
        saveLayoutToCloud(newPagesData);
    };

    const assignComponent = (componentId, dictData, isCustom = false, customData = null) => {
        const newPagesData = [...pagesData];
        const currentPageData = [...newPagesData[currentPage]];
        
        let computedTargetPage = undefined;

        if (componentId.includes('folder') || dictData.type === 'folder') {
            for (let i = 1; i < 10; i++) {
                const isEmpty = newPagesData[i].every(cell => !cell || cell === "");
                const isPointedTo = newPagesData.some(page => page.some(c => c && c.targetPage === i));
                if (isEmpty && !isPointedTo) { computedTargetPage = i; break; }
            }
            if (computedTargetPage === undefined) return window.alert("No more free pages available for new folders!");

            newPagesData[computedTargetPage][0] = { 
                id: "nav_back", 
                label: "BACK", 
                baseType: "nav_back", 
                type: "nav", 
                targetPage: currentPage 
            };
        }
        else if (componentId.includes('nav_back') || dictData.baseType?.includes('nav_back') || componentId === 'nav_back') {
            let parentPage = 0;
            for (let i = 0; i < 10; i++) {
                if (newPagesData[i].some(cell => cell && cell.id?.includes('folder') && cell.targetPage === currentPage)) {
                    parentPage = i;
                    break;
                }
            }
            computedTargetPage = parentPage;
        }
        else if (componentId.includes('nav_home') || componentId === 'nav_home') {
            computedTargetPage = 0;
        }
        else if (dictData.targetPage !== undefined) {
            computedTargetPage = dictData.targetPage;
        }

        if (isCustom && customData) {
            currentPageData[selectedCellIndex] = {
                ...customData,
                ...(computedTargetPage !== undefined && { targetPage: computedTargetPage })
            };
        } else {
            currentPageData[selectedCellIndex] = {
                id: componentId,
                label: dictData.name.substring(0, 12).toUpperCase(),
                baseType: componentId,
                type: dictData.type,
                ...(computedTargetPage !== undefined && { targetPage: computedTargetPage })
            };
        }
        
        newPagesData[currentPage] = currentPageData;
        setPagesData(newPagesData);
        saveLayoutToCloud(newPagesData);
        setIsModalOpen(false);
        setSelectedCellIndex(null);
    };

    const saveCellSettings = (updatedCellData) => {
        const newPagesData = [...pagesData];
        newPagesData[currentPage][selectedCellIndex] = updatedCellData;
        setPagesData(newPagesData);
        saveLayoutToCloud(newPagesData);
        setIsCellSettingsOpen(false);
        setSelectedCellIndex(null);
    };

    const handleSaveToLibrary = async (componentConfig) => {
        if (!user) return;
        const customId = "custom_" + Math.random().toString(36).substr(2, 9);
        const payload = { ...componentConfig, id: customId };
        
        await set(ref(database, `users/${user.uid}/customComponents/${customId}`), payload);
        window.alert("Saved to your Custom Library!");
        setIsCellSettingsOpen(false);
        setSelectedCellIndex(null);
    };

    const handleDeleteFromLibrary = async (customId) => {
        if (!user) return;
        if (window.confirm("Delete this custom component from your library? This will also remove it from your active layout.")) {
            // 1. Delete from Firebase Custom Library
            await set(ref(database, `users/${user.uid}/customComponents/${customId}`), null);
            
            // 2. Cascade Delete: Scrub the active layout of any ghost cells
            const newPagesData = pagesData.map(page => 
                page.map(cell => (cell && cell.id === customId) ? "" : cell)
            );
            
            setPagesData(newPagesData);
            saveLayoutToCloud(newPagesData);
        }
    };

    const handleUnpair = () => {
        if (window.confirm("Are you sure you want to unpair this simulator connection?")) {
            localStorage.removeItem("efb_pairing_pin");
            setUserPin(null);
            setIsSettingsOpen(false);
        }
    };

    const handleCreateProfile = async () => {
        let newName = window.prompt("New Layout\nEnter a name for the new layout:");
        if (newName && newName.trim() !== "") {
            let cleanName = newName.trim();
            let tag = window.prompt("Aircraft Tag (Optional):", "Global");
            if (tag === null) return;

            await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: tag || "Global" });
            setCurrentProfile(cleanName);
            setCurrentPage(0);
            setIsProfileModalOpen(false);
            setIsEditMode(true);
        }
    };

    const handleDuplicateProfile = async () => {
        let newName = window.prompt(`Duplicate Profile\nDuplicate "${currentProfile}" as:`, `${currentProfile} V2`);
        if (newName && newName.trim() !== "") {
            let cleanName = newName.trim();
            let existingTag = availableProfiles[currentProfile]?.aircraftTag || "Global";

            if (availableProfiles[cleanName]) {
                if (!window.confirm(`A profile named "${cleanName}" already exists. Overwrite it?`)) return;
            }

            await set(ref(database, `users/${user.uid}/layouts/${cleanName}`), pagesData);
            await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: existingTag });
            
            setCurrentProfile(cleanName);
            setIsProfileModalOpen(false);
            setIsEditMode(true);
        }
    };

    const handleRenameProfile = async () => {
        if (currentProfile === "Default") return window.alert("The 'Default' profile cannot be renamed.");
        let newName = window.prompt(`Rename Profile\nRename "${currentProfile}" to:`, currentProfile);
        if (newName && newName.trim() !== "" && newName.trim() !== currentProfile) {
            let cleanName = newName.trim();
            let existingTag = availableProfiles[currentProfile]?.aircraftTag || "Global";
            if (availableProfiles[cleanName]) {
                if (!window.confirm(`A profile named "${cleanName}" already exists. Overwrite it?`)) return;
            }
            let oldName = currentProfile;
            await set(ref(database, `users/${user.uid}/layouts/${cleanName}`), pagesData);
            await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: existingTag });
            await set(ref(database, `users/${user.uid}/layouts/${oldName}`), null);
            await set(ref(database, `users/${user.uid}/profiles/${oldName}`), null);
            setCurrentProfile(cleanName);
            setIsProfileModalOpen(false);
        }
    };

    const handleDeleteProfile = async () => {
        if (currentProfile === "Default") return window.alert("The 'Default' profile cannot be deleted.");
        if (window.confirm(`Delete Profile\nAre you absolutely sure you want to delete "${currentProfile}"?`)) {
            let oldName = currentProfile;
            setCurrentProfile("Default");
            setCurrentPage(0);
            await set(ref(database, `users/${user.uid}/layouts/${oldName}`), null);
            await set(ref(database, `users/${user.uid}/profiles/${oldName}`), null);
            setIsProfileModalOpen(false);
        }
    };

    const handleShareProfile = async () => {
        let tag = window.prompt("Share Profile\nAdd an Aircraft Tag:", availableProfiles[currentProfile]?.aircraftTag || "General Aviation");
        if (tag === null) return;
        const shareCode = "SH-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const exportPayload = { layoutData: pagesData, aircraftTag: tag.trim() || "Global" };
        try {
            await set(ref(database, `efb_shared_profiles/${shareCode}`), exportPayload);
            window.prompt("Profile Shared!\nCopy this Share Code:", shareCode);
        } catch (e) {
            window.alert("Error sharing profile. Check Firebase permissions.");
        }
    };

    const handleImportProfile = async () => {
        let code = window.prompt("Import Profile\nEnter the Share Code (e.g. SH-A1B2C3):");
        if (!code) return;
        code = code.trim().toUpperCase();
        const snapshot = await get(ref(database, `efb_shared_profiles/${code}`));
        if (snapshot.exists()) {
            const importedPayload = snapshot.val();
            const layoutDataToImport = importedPayload.layoutData || importedPayload;
            const importedTag = importedPayload.aircraftTag || "Imported Profile";
            let newName = window.prompt(`Save Imported Profile\nFound profile for: [${importedTag}]\nSave as:`, `${importedTag} Setup`);
            if (newName && newName.trim() !== "") {
                let cleanName = newName.trim();
                if (availableProfiles[cleanName]) {
                    if (!window.confirm(`A profile named "${cleanName}" already exists. Overwrite?`)) return;
                }
                await set(ref(database, `users/${user.uid}/layouts/${cleanName}`), layoutDataToImport);
                await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: importedTag });
                setCurrentProfile(cleanName);
                setCurrentPage(0);
                setIsProfileModalOpen(false);
                setIsEditMode(true); 
                window.alert("Profile imported successfully!");
            }
        } else {
            window.alert("Invalid or expired Share Code.");
        }
    };

    // --- RENDER PREP ---
    let breadcrumbText = "HOME";
    if (currentPage > 0) {
        for (let p = 0; p < 10; p++) {
            const folder = pagesData[p].find(c => c && c.targetPage === currentPage);
            if (folder && folder.label) {
                breadcrumbText = `HOME > ${folder.label}`;
                break;
            }
        }
    }

    if (loading) return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Loading MSFS Panel Builder...</div>;
    if (!user) return <AuthScreen />;
    
    // --- ADMIN OVERLAY ---
    if (showAdmin) {
        return <AdminDashboard onClose={() => setShowAdmin(false)} />;
    }

    if (!userPin || isPairing) {
        return (
            <PinScreen 
                onPinSubmit={(pin) => { setUserPin(pin); setIsPairing(true); }} 
                connectionStatus={isPairing ? connectionStatus : 'idle'}
                onCancel={() => { setUserPin(null); setIsPairing(false); }}
            />
        );
    }

    return (
        <div className="app-container">
            <TopBar 
                currentProfile={currentProfile}
                isEditMode={isEditMode}
                toggleMode={() => setIsEditMode(!isEditMode)}
                openSettings={() => setIsSettingsOpen(true)} 
                openProfiles={() => setIsProfileModalOpen(true)}
                connectionStatus={connectionStatus}
                breadcrumbText={breadcrumbText}
                currentPage={currentPage}
                onGoHome={() => setCurrentPage(0)}
            />

            <Grid 
                pageData={pagesData[currentPage]} 
                isEditMode={isEditMode} 
                onCellClick={handleCellClick}
                onDeleteCell={handleDeleteCell}
                onDropCell={handleDropCell}
                onNavigate={(page) => setCurrentPage(page)}
                simState={simState}           
                sendCommand={sendCommand}
                theme={theme}
            />

            <ComponentModal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setSelectedCellIndex(null); }} 
                onSelect={assignComponent} 
                customComponents={customComponents}
                onDeleteCustom={handleDeleteFromLibrary}
            />

            <CellSettingsModal 
                isOpen={isCellSettingsOpen}
                onClose={() => { setIsCellSettingsOpen(false); setSelectedCellIndex(null); }}
                cellData={selectedCellIndex !== null ? pagesData[currentPage][selectedCellIndex] : null}
                onSave={saveCellSettings}
                onSaveToLibrary={handleSaveToLibrary}
            />

            <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                currentProfile={currentProfile}
                availableProfiles={availableProfiles}
                onSelectProfile={(profName) => { setCurrentProfile(profName); setCurrentPage(0); setIsProfileModalOpen(false); }}
                onCreateNew={handleCreateProfile}
                onDuplicate={handleDuplicateProfile}
                onRename={handleRenameProfile}
                onDelete={handleDeleteProfile}
                onShare={handleShareProfile}
                onImport={handleImportProfile}
            />

            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                userPin={userPin}
                onUnpair={handleUnpair}
                onLogout={() => auth.signOut()}
                isAdmin={isAdmin}
                onOpenAdmin={() => { 
                    setIsSettingsOpen(false); 
                    setShowAdmin(true); 
                }}
                theme={theme}
                cycleTheme={cycleTheme}
            />
        </div>
    );
}

export default App;