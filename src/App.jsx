import { useState, useEffect, useCallback } from 'react';
import { auth, database } from './utils/firebase';
import { ref, set, get } from 'firebase/database';

// --- COMPONENTS ---
import AuthScreen from './components/AuthScreen';
import PinScreen from './components/PinScreen';
import TopBar from './components/TopBar';
import Grid from './components/Grid';
import ComponentModal from './components/ComponentModal';
import SettingsModal from './components/SettingsModal';
import CellSettingsModal from './components/CellSettingsModal';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';

// --- HOOKS ---
import useMSFS from './hooks/useMSFS';
import useDebouncedSave from './hooks/useDebouncedSave';
import useAuth from './hooks/useAuth';
import useProfiles from './hooks/useProfiles';
import useCustomComponents from './hooks/useCustomComponents';
import useLayoutData from './hooks/useLayoutData';

// --- CONTEXTS ---
import { useDialog } from './contexts/DialogContext'; // <-- The Dialog Hook is back!

// --- MOBILE DRAG & DROP POLYFILL ---
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css"; 

polyfill({
    holdToDrag: 100 
});

window.addEventListener('touchmove', function() {}, {passive: false});
// -----------------------------------

function App() {
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

    // ==========================================
    // --- CUSTOM DATA HOOKS & CONTEXTS ---
    // ==========================================
    const { user, loading, isAdmin } = useAuth();
    const availableProfiles = useProfiles(user);
    const customComponents = useCustomComponents(user);
    const { pagesData, setPagesData } = useLayoutData(user, currentProfile);
    const { simState, connectionStatus, sendCommand } = useMSFS(userPin, pagesData);
    
    // Initialize our sleek UI dialogs!
    const { confirm, prompt } = useDialog(); 

    // --- THEME SIDE EFFECT ---
    useEffect(() => {
        localStorage.setItem('efb_theme', theme);
        document.body.classList.remove('theme-retro', 'theme-retro-green', 'theme-retro-blue', 'theme-retro-amber');
        
        if (theme === 'retro-green') document.body.classList.add('theme-retro', 'theme-retro-green');
        else if (theme === 'retro-blue') document.body.classList.add('theme-retro', 'theme-retro-blue');
        else if (theme === 'retro-amber') document.body.classList.add('theme-retro', 'theme-retro-amber');
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

    // --- MODE SIDE EFFECT ---
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


    // ==========================================
    // --- DEBOUNCED LAYOUT SAVING ---
    // ==========================================
    const saveLayoutToCloud = useCallback((newLayoutData) => {
        if (user && currentProfile) {
            set(ref(database, `users/${user.uid}/layouts/${currentProfile}`), newLayoutData).catch(e => console.error(e));
        }
    }, [user, currentProfile]);

    const debouncedSaveLayout = useDebouncedSave(saveLayoutToCloud, 500);


    // ==========================================
    // --- GRID INTERACTION HANDLERS ---
    // ==========================================
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

                if (isCustomizable) setIsCellSettingsOpen(true);
            } else {
                setIsModalOpen(true);
            }
        }
    };

    const handleDeleteCell = async (index) => {
        const cellData = pagesData[currentPage][index];
        const newPagesData = [...pagesData];

        if (cellData && cellData.targetPage) {
            const isConfirmed = await confirm({
                title: "Delete Folder",
                message: `Delete folder "${cellData.label}"? This will also wipe all buttons inside that folder.`,
                confirmText: "Delete"
            });
            if (isConfirmed) {
                newPagesData[cellData.targetPage] = new Array(24).fill(""); 
            } else {
                return; 
            }
        }

        newPagesData[currentPage][index] = ""; 
        setPagesData(newPagesData);
        debouncedSaveLayout(newPagesData);
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
        debouncedSaveLayout(newPagesData);
    };

    const assignComponent = async (componentId, dictData, isCustom = false, customData = null) => {
        const newPagesData = [...pagesData];
        const currentPageData = [...newPagesData[currentPage]];
        let computedTargetPage = undefined;

        if (componentId.includes('folder') || dictData.type === 'folder') {
            for (let i = 1; i < 10; i++) {
                const isEmpty = newPagesData[i].every(cell => !cell || cell === "");
                const isPointedTo = newPagesData.some(page => page.some(c => c && c.targetPage === i));
                if (isEmpty && !isPointedTo) { computedTargetPage = i; break; }
            }
            if (computedTargetPage === undefined) {
                await confirm({ title: "Limit Reached", message: "No more free pages available for new folders!", cancelText: null, confirmText: "OK" });
                return;
            }

            newPagesData[computedTargetPage][0] = { 
                id: "nav_back", label: "BACK", baseType: "nav_back", type: "nav", targetPage: currentPage 
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
        debouncedSaveLayout(newPagesData);
        setIsModalOpen(false);
        setSelectedCellIndex(null);
    };

    const saveCellSettings = (updatedCellData) => {
        const newPagesData = [...pagesData];
        newPagesData[currentPage][selectedCellIndex] = updatedCellData;
        setPagesData(newPagesData);
        debouncedSaveLayout(newPagesData);
        setIsCellSettingsOpen(false);
        setSelectedCellIndex(null);
    };

    const handleSaveToLibrary = async (componentConfig) => {
        if (!user) return;
        const customId = "custom_" + Math.random().toString(36).substr(2, 9);
        const payload = { ...componentConfig, id: customId };
        
        await set(ref(database, `users/${user.uid}/customComponents/${customId}`), payload);
        await confirm({ title: "Success", message: "Saved to your Custom Library!", cancelText: null, confirmText: "OK" });
        setIsCellSettingsOpen(false);
        setSelectedCellIndex(null);
    };

    const handleDeleteFromLibrary = async (customId) => {
        if (!user) return;
        const isConfirmed = await confirm({ 
            title: "Delete Custom Component", 
            message: "Delete this custom component from your library? This will also remove it from your active layout.",
            confirmText: "Delete"
        });

        if (isConfirmed) {
            await set(ref(database, `users/${user.uid}/customComponents/${customId}`), null);
            const newPagesData = pagesData.map(page => 
                page.map(cell => (cell && cell.id === customId) ? "" : cell)
            );
            setPagesData(newPagesData);
            debouncedSaveLayout(newPagesData);
        }
    };

    // ==========================================
    // --- PROFILE / SETTINGS HANDLERS ---
    // ==========================================
    const handleUnpair = async () => {
        const isConfirmed = await confirm({
            title: "Unpair",
            message: "Are you sure you want to unpair this simulator connection?",
            confirmText: "Unpair"
        });

        if (isConfirmed) {
            localStorage.removeItem("efb_pairing_pin");
            setUserPin(null);
            setIsSettingsOpen(false);
        }
    };

    const handleCreateProfile = async () => {
        let newName = await prompt({ title: "New Layout", message: "Enter a name for the new layout:" });
        if (newName && newName.trim() !== "") {
            let cleanName = newName.trim();
            let tag = await prompt({ title: "Aircraft Tag", message: "Enter an Aircraft Tag (Optional):", defaultValue: "Global" });
            if (tag === null) return;

            await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: tag || "Global" });
            setCurrentProfile(cleanName);
            setCurrentPage(0);
            setIsProfileModalOpen(false);
            setIsEditMode(true);
        }
    };

    const handleDuplicateProfile = async () => {
        let newName = await prompt({ title: "Duplicate Profile", message: `Duplicate "${currentProfile}" as:`, defaultValue: `${currentProfile} V2` });
        if (newName && newName.trim() !== "") {
            let cleanName = newName.trim();
            let existingTag = availableProfiles[currentProfile]?.aircraftTag || "Global";

            if (availableProfiles[cleanName]) {
                const overwrite = await confirm({ title: "Overwrite Profile", message: `A profile named "${cleanName}" already exists. Overwrite it?`, confirmText: "Overwrite" });
                if (!overwrite) return;
            }

            await set(ref(database, `users/${user.uid}/layouts/${cleanName}`), pagesData);
            await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: existingTag });
            setCurrentProfile(cleanName);
            setIsProfileModalOpen(false);
            setIsEditMode(true);
        }
    };

    const handleRenameProfile = async () => {
        if (currentProfile === "Default") {
            await confirm({ title: "Action Not Allowed", message: "The 'Default' profile cannot be renamed.", cancelText: null, confirmText: "OK" });
            return;
        }

        let newName = await prompt({ title: "Rename Profile", message: `Rename "${currentProfile}" to:`, defaultValue: currentProfile });
        if (newName && newName.trim() !== "" && newName.trim() !== currentProfile) {
            let cleanName = newName.trim();
            let existingTag = availableProfiles[currentProfile]?.aircraftTag || "Global";
            
            if (availableProfiles[cleanName]) {
                const overwrite = await confirm({ title: "Overwrite Profile", message: `A profile named "${cleanName}" already exists. Overwrite it?`, confirmText: "Overwrite" });
                if (!overwrite) return;
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
        if (currentProfile === "Default") {
            await confirm({ title: "Action Not Allowed", message: "The 'Default' profile cannot be deleted.", cancelText: null, confirmText: "OK" });
            return;
        }

        const isConfirmed = await confirm({ title: "Delete Profile", message: `Are you absolutely sure you want to delete "${currentProfile}"?`, confirmText: "Delete" });
        if (isConfirmed) {
            let oldName = currentProfile;
            setCurrentProfile("Default");
            setCurrentPage(0);
            await set(ref(database, `users/${user.uid}/layouts/${oldName}`), null);
            await set(ref(database, `users/${user.uid}/profiles/${oldName}`), null);
            setIsProfileModalOpen(false);
        }
    };

    const handleShareProfile = async () => {
        let tag = await prompt({ title: "Share Profile", message: "Add an Aircraft Tag:", defaultValue: availableProfiles[currentProfile]?.aircraftTag || "General Aviation" });
        if (tag === null) return;
        
        const shareCode = "SH-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const exportPayload = { layoutData: pagesData, aircraftTag: tag.trim() || "Global" };
        try {
            await set(ref(database, `efb_shared_profiles/${shareCode}`), exportPayload);
            // Reusing the prompt purely so the user can easily copy/paste the share code!
            await prompt({ title: "Profile Shared!", message: "Copy this Share Code:", defaultValue: shareCode, cancelText: null, confirmText: "Done" });
        } catch (e) {
            await confirm({ title: "Error", message: "Error sharing profile. Check Firebase permissions.", cancelText: null, confirmText: "OK" });
        }
    };

    const handleImportProfile = async () => {
        let code = await prompt({ title: "Import Profile", message: "Enter the Share Code (e.g. SH-A1B2C3):" });
        if (!code) return;
        code = code.trim().toUpperCase();
        const snapshot = await get(ref(database, `efb_shared_profiles/${code}`));
        
        if (snapshot.exists()) {
            const importedPayload = snapshot.val();
            const layoutDataToImport = importedPayload.layoutData || importedPayload;
            const importedTag = importedPayload.aircraftTag || "Imported Profile";
            
            let newName = await prompt({ title: "Save Imported Profile", message: `Found profile for: [${importedTag}]\nSave as:`, defaultValue: `${importedTag} Setup` });
            if (newName && newName.trim() !== "") {
                let cleanName = newName.trim();
                if (availableProfiles[cleanName]) {
                    const overwrite = await confirm({ title: "Overwrite Profile", message: `A profile named "${cleanName}" already exists. Overwrite?`, confirmText: "Overwrite" });
                    if (!overwrite) return;
                }
                await set(ref(database, `users/${user.uid}/layouts/${cleanName}`), layoutDataToImport);
                await set(ref(database, `users/${user.uid}/profiles/${cleanName}`), { name: cleanName, aircraftTag: importedTag });
                setCurrentProfile(cleanName);
                setCurrentPage(0);
                setIsProfileModalOpen(false);
                setIsEditMode(true); 
                await confirm({ title: "Success", message: "Profile imported successfully!", cancelText: null, confirmText: "OK" });
            }
        } else {
            await confirm({ title: "Error", message: "Invalid or expired Share Code.", cancelText: null, confirmText: "OK" });
        }
    };

    // ==========================================
    // --- RENDER ---
    // ==========================================
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