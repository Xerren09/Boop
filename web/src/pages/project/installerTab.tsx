import { useInstallStreamer, type InstallerStatus } from "../../api/streamers/useInstallStreamer";
import Section from "../../components/section";
import Stack from "../../components/stack";
import RemoteProcessGroup from "../../components/processGroup";
import { Text } from "@fluentui/react-components";

const statusHeadingMap: { [key in NonNullable<InstallerStatus>]: string } = {
    "pending": "Installing",
    "error": "Installer failed",
    "ok": "Installer complete"
}

export default function ProjectInstallerTab(props: { projectId: string }) {
    const { steps, status, triggerEvent } = useInstallStreamer(props.projectId);
    
    // TODO: Add installer ref to the build group subtitle that links to the corresponding webhook event that triggered it

    return (
        <Stack horizontalFill gap={24}>
            <Section
                title={ statusHeadingMap[status] }
            >
                {
                    status === "pending" &&
                    <Text>
                        This project is currently installing. You can follow the progress below. Once the installer completed, it will be automatically deployed if successful.
                    </Text>
                }
                {
                    status === "error" &&
                    <Text>
                        The project installer has failed. This means your build is failing. Typically you can fix it by pushing a commit to the target branch of your repository.
                        
                        Check the log below to see which step failed.
                    </Text>
                }
                {
                    status === "ok" &&
                    <Text>
                        This project has just been installed, and will be deployed momentarily.
                    </Text>
                }            
            </Section>

            <RemoteProcessGroup
                title="Installer"
                subtitle={triggerEvent}
                processes={steps}
            />
        </Stack>
    );
}