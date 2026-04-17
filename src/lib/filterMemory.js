export const getFilter = (section, defaultValue = null) => {
    if (typeof window === 'undefined') return defaultValue;
    return localStorage.getItem(`fnce_filter_${section}`) || defaultValue;
};

export const setFilter = (section, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`fnce_filter_${section}`, value);
};
