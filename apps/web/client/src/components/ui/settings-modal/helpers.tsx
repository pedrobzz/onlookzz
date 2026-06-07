export enum SettingsTabValue {
    PROJECT = 'project',
    VERSIONS = 'versions',
    SITE = 'site',
}

export interface SettingTab {
    label: SettingsTabValue | string;
    icon: React.ReactNode;
    component: React.ReactNode;
}

export const ComingSoonTab = () => {
    return <div>Coming soon...</div>;
};
