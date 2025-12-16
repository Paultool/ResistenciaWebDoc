// --- DICCIONARIO DE TRADUCCIÓN ---
// Definir tipos para el diccionario
export type TranslationKeys = {
    loading_stories: string;
    connect_db: string;
    access_mem: string;
    decrypting: string;
    buffer_status: string;
    sync_status: string;
    no_signal: string;
    no_stories_msg: string;
    await_trans: string;
    sys_failure: string;
    err_void: string;
    err_load: string;
    abort_retry: string;
    mission_complete: string;
    data_saved_msg: string;
    return_hub: string;
    hub_loading: string;

    // Hub Cards
    sec_prefix: string;
    completed: string;
    locked: string;
    req: string;
    execute: string;
    add_fav: string;
    remove_fav: string;

    // Step Content
    narrative_incoming: string;
    next: string;
    continue_adv: string;
    decision_crit: string;
    waiting_input: string;
    seq_completed: string;
    conn_terminated: string;
    data_saved: string;
    next_phase: string;
    end_sim: string;

    // 3D Instructions
    nav_proto: string;
    touch_iface: string;
    peripherals: string;
    online: string;
    instruct_text: string;
    nodes_interest: string;
    virt_joy: string;
    move: string;
    screen: string;
    swipe_tap: string;
    keyboard: string;
    movement: string;
    mouse: string;
    click_drag: string;
    start: string;

    // Modals & Bottom Bar
    map: string;
    inv: string;
    crew: string;
    logs: string;
    xp: string;
    nodes: string;
    vol: string;
    cam: string;

    res_storage: string;
    capacity: string;
    items_label: string;
    empty_storage: string;
    db_crew: string;
    select_subj: string;
    view_file: string;
    no_records: string;
    mission_logs: string;
    return_hub_btn: string;
    no_data_logs: string;

    file_title: string;
    access_lvl: string;
    psych_profile: string;
    tech_attr: string;

    hotspot_unknown: string;

    // Modals Extra
    locked_title: string;
    unlock_msg: string;
    must_complete_msg: string;
    go_req_story: string;
    cancel: string;
    prev_step: string;
    next_step: string;
    close_btn: string;
    total: string;
};

export const flujoTranslations: Record<'es' | 'en', TranslationKeys> = {
    es: {
        loading_stories: "RECUPERANDO_HISTORIAS",
        connect_db: "CONECTANDO BASE DE DATOS",
        access_mem: "ACCEDIENDO_MEMORIA",
        decrypting: "Desencriptando fragmentos narrativos...",
        buffer_status: "BUFFER: 64KB",
        sync_status: "ESTADO: SYNC",
        no_signal: "NO_SIGNAL_DETECTED",
        no_stories_msg: "No se han encontrado historias disponibles en este sector de la memoria.",
        await_trans: "ESPERANDO TRANSMISIÓN...",
        sys_failure: "SYSTEM FAILURE",
        err_void: "ERR_CODE: NARRATIVE_VOID",
        err_load: "No se pudo cargar el flujo narrativo.",
        abort_retry: "ABORTAR Y REINICIAR",
        mission_complete: "MISIÓN COMPLETADA",
        data_saved_msg: "Los datos han sido recuperados exitosamente.\nTu contribución a la memoria colectiva ha sido registrada.",
        return_hub: "FINALIZAR Y VOLVER AL HUB",
        hub_loading: "CARGANDO...",

        // Hub Cards
        sec_prefix: "SEC_",
        completed: "COMPLETED",
        locked: "BLOQUEADO",
        req: "REQ:",
        execute: "EJECUTAR",
        add_fav: "Agregar a favoritos",
        remove_fav: "Remover de favoritos",

        // Step Content
        narrative_incoming: "NARRATIVA_ENTRANTE",
        next: "Siguiente",
        continue_adv: "Continuar Aventura",
        decision_crit: "DECISIÓN_CRÍTICA",
        waiting_input: "WAITING_INPUT...",
        seq_completed: "SECUENCIA_COMPLETADA",
        conn_terminated: "CONEXIÓN_FINALIZADA",
        data_saved: "DATOS GUARDADOS CORRECTAMENTE",
        next_phase: "SIGUIENTE FASE",
        end_sim: "TERMINAR SIMULACIÓN",

        // 3D Instructions
        nav_proto: "PROTOCOLO DE NAVEGACIÓN",
        touch_iface: "INTERFAZ TÁCTIL DETECTADA",
        peripherals: "PERIFÉRICOS DETECTADOS",
        online: "ONLINE",
        instruct_text: "Para avanzar en la simulación, localiza y descifra los Nodos de Interés ocultos.",
        nodes_interest: "NODOS DE INTERÉS",
        virt_joy: "JOYSTICK VIRTUAL",
        move: "Moverse",
        screen: "PANTALLA",
        swipe_tap: "Deslizar: Mirar / Tap: Interactuar",
        keyboard: "TECLADO",
        movement: "Desplazamiento",
        mouse: "MOUSE",
        click_drag: "Clic + Arrastrar: Mirar",
        start: "INICIAR",

        // Modals & Bottom Bar
        map: "MAPA",
        inv: "INV",
        crew: "CREW",
        logs: "LOGS",
        xp: "XP",
        nodes: "NODOS",
        vol: "VOL",
        cam: "CAM",

        res_storage: "ALMACÉN DE RECURSOS",
        capacity: "CAPACIDAD: ILIMITADA",
        items_label: "ITEMS",
        empty_storage: "ALMACÉN VACÍO. RECOLECTA OBJETOS.",
        db_crew: "BASE DE DATOS: CREW",
        select_subj: "SELECCIONE SUJETO PARA ANÁLISIS DETALLADO",
        view_file: "VER EXPEDIENTE",
        no_records: "SIN REGISTROS. INTERACTÚA CON EL ENTORNO.",
        mission_logs: "LOGS DE MISIÓN",
        return_hub_btn: "RETORNAR AL HUB",
        no_data_logs: "SIN DATOS. EXPLORACIÓN REQUERIDA.",

        file_title: "EXPEDIENTE:",
        access_lvl: "NIVEL DE ACCESO: CONFIDENCIAL",
        psych_profile: "PERFIL PSICOLÓGICO / BIO",
        tech_attr: "ATRIBUTOS TÉCNICOS",

        hotspot_unknown: "ARCHIVO_DESCONOCIDO",

        locked_title: "Historia Bloqueada",
        unlock_msg: "Para desbloquear",
        must_complete_msg: "primero debes completar la historia:",
        go_req_story: "Ir a Historia Requerida →",
        cancel: "Cancelar",
        prev_step: "Paso Anterior",
        next_step: "Siguiente Paso",
        close_btn: "[ CERRAR ]",
        total: "TOTAL"
    },
    en: {
        loading_stories: "RETRIEVING_STORIES",
        connect_db: "CONNECTING DATABASE",
        access_mem: "ACCESSING_MEMORY",
        decrypting: "Decrypting narrative fragments...",
        buffer_status: "BUFFER: 64KB",
        sync_status: "STATUS: SYNC",
        no_signal: "NO_SIGNAL_DETECTED",
        no_stories_msg: "No stories found in this memory sector.",
        await_trans: "AWAITING TRANSMISSION...",
        sys_failure: "SYSTEM FAILURE",
        err_void: "ERR_CODE: NARRATIVE_VOID",
        err_load: "Could not load narrative flow.",
        abort_retry: "ABORT AND RETRY",
        mission_complete: "MISSION COMPLETE",
        data_saved_msg: "Data successfully retrieved.\nYour contribution to the collective memory has been registered.",
        return_hub: "FINISH AND RETURN TO HUB",
        hub_loading: "LOADING...",

        // Hub Cards
        sec_prefix: "SEC_",
        completed: "COMPLETED",
        locked: "LOCKED",
        req: "REQ:",
        execute: "EXECUTE",
        add_fav: "Add to favorites",
        remove_fav: "Remove from favorites",

        // Step Content
        narrative_incoming: "INCOMING_NARRATIVE",
        next: "Next",
        continue_adv: "Continue Adventure",
        decision_crit: "CRITICAL_DECISION",
        waiting_input: "WAITING_INPUT...",
        seq_completed: "SEQUENCE_COMPLETED",
        conn_terminated: "CONNECTION_TERMINATED",
        data_saved: "DATA SAVED SUCCESSFULLY",
        next_phase: "NEXT PHASE",
        end_sim: "END SIMULATION",

        // 3D Instructions
        nav_proto: "NAVIGATION_PROTOCOL",
        touch_iface: "TOUCH INTERFACE DETECTED",
        peripherals: "PERIPHERALS DETECTED",
        online: "ONLINE",
        instruct_text: "To proceed, locate and decipher the hidden Interest Nodes.",
        nodes_interest: "INTEREST NODES",
        virt_joy: "VIRTUAL JOYSTICK",
        move: "Move",
        screen: "SCREEN",
        swipe_tap: "Swipe: Look / Tap: Interact",
        keyboard: "KEYBOARD",
        movement: "Movement",
        mouse: "MOUSE",
        click_drag: "Click + Drag: Look",
        start: "START",

        // Modals & Bottom Bar
        map: "MAP",
        inv: "INV",
        crew: "CREW",
        logs: "LOGS",
        xp: "XP",
        nodes: "NODES",
        vol: "VOL",
        cam: "CAM",

        res_storage: "RESOURCE STORAGE",
        capacity: "CAPACITY: UNLIMITED",
        items_label: "ITEMS",
        empty_storage: "STORAGE EMPTY. COLLECT OBJECTS.",
        db_crew: "DATABASE: CREW",
        select_subj: "SELECT SUBJECT FOR DETAILED ANALYSIS",
        view_file: "VIEW FILE",
        no_records: "NO RECORDS. INTERACT WITH ENVIRONMENT.",
        mission_logs: "MISSION LOGS",
        return_hub_btn: "RETURN TO HUB",
        no_data_logs: "NO DATA. EXPLORATION REQUIRED.",

        file_title: "FILE:",
        access_lvl: "ACCESS LEVEL: CONFIDENTIAL",
        psych_profile: "PSYCH PROFILE / BIO",
        tech_attr: "TECH ATTRIBUTES",

        hotspot_unknown: "UNKNOWN_FILE",

        locked_title: "Story Locked",
        unlock_msg: "To unlock",
        must_complete_msg: "you must first complete:",
        go_req_story: "Go to Required Story →",
        cancel: "Cancel",
        prev_step: "Previous Step",
        next_step: "Next Step",
        close_btn: "[ CLOSE ]",
        total: "TOTAL"
    }
};

// Helper para contenido localizado desde DB
export const getLocalizedContent = (obj: any, field: string, lang: 'es' | 'en') => {
    if (!obj) return '';
    // Intentar buscar campo con sufijo _en si el idioma es inglés
    if (lang === 'en') {
        return obj[`${field}_en`] || obj[field] || '';
    }
    // Por defecto devolver el campo original (asumido español)
    return obj[field] || '';
};
