import { useEffect, useMemo, useState } from "react";
import styles from "./index.module.css";
import Stack from "../../components/stack";
import { Caption1, LargeTitle, Link, Subtitle2 } from "@fluentui/react-components";
import Runtime from "../../components/runtime";
import { BoopAPI, type BoopStatus } from "../../api/api";
import BoopProjectsTab from "./tabs/projects.tab";
import ThemeSwitchButton from "../../components/theme/button";

export function FrontPage() {
    const [status, setStatus] = useState<BoopStatus | null>(null);

    useEffect(() => {
        window.document.title = "Dashboard | Boop";
        BoopAPI.getStatus().then(status => {
            if (status) {
                setStatus(status);
            }
        });
    }, []);

    const startupTime = useMemo(() => {
        // eslint-disable-next-line react-hooks/purity
        return status ? Date.now() - (status.uptime * 1000) : 0;
    }, [status])

    return (
        <Stack gap={18} style={{ padding: 12 }} horizontalFill verticalFill>
            <Stack>
                <LargeTitle style={{color: "#00abec"}}>Boop!</LargeTitle>
                <Subtitle2><Link href="https://github.com/Xerren09/Boop" target="_blank">A lightweight NodeJS CI/CD server for GitHub repositories</Link></Subtitle2>
                <Caption1 italic>Node { status?.nodeVer }  //  { status?.system }-{ status?.arch }  //  <Runtime short start={startupTime}/></Caption1>
            </Stack>

            <Stack gap={16} horizontalAlign="end" id={styles.frontPageContent}>
                <ThemeSwitchButton/>
    
                <BoopProjectsTab />
                {
                    /*
                    <TabList
                        selectedValue={currentTab}
                        onTabSelect={(_, data) => {
                            switchTab(data.value as number);
                        }}
                    >
                        <Tab title="Projects" value={DashboardTab.Projects} />
                        <Tab title="Log" value={DashboardTab.Log}/>
                    </TabList>
                    <Stack>
                        {
                            currentTab == DashboardTab.Projects && <BoopProjectsTab/>
                        }
                        {
                            currentTab == DashboardTab.Log
                        }
                    </Stack>
                    */
                }
            </Stack>
        </Stack>
    );
}