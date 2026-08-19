import { ErrorCircleColor, HomeColor } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import  Stack from "../../components/stack";
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger } from "@fluentui/react-components";
import { BoopAPI, BoopProject, ProjectProvider } from "../../api/api";
import ProjectPageSkeleton from "./skeleton";
import ThemeSwitchButton from "../../components/theme/button";
import { ProjectPageContent } from "./content";

export default function ProjectPage() {
    const { projectId } = useParams<string>();
    const navigation = useNavigate();
    const [project, setProject] = useState<BoopProject | null | undefined>(undefined);

    useEffect(() => {
        window.document.title = `${projectId} | Boop`;
        async function getProject() {
            if (projectId) {
                try {
                    const proj = await BoopAPI.getProject(projectId);
                    if (proj) {
                        setProject(proj);
                    }
                }
                catch {
                    setProject(null);
                }
            }
        }
        getProject();
    }, [navigation, projectId]);


    return (
        <ProjectProvider value={project ?? null}>
            <Stack horizontalAlign="start" style={{ minWidth: "75%", marginTop: 6, padding: 12 }} gap={12} verticalFill horizontalFill>
                <Stack horizontal horizontalFill horizontalAlign="space-between">
                    <Breadcrumb size="large">
                        <BreadcrumbItem>
                            <BreadcrumbButton onClick={() => { navigation(".."); }}><HomeColor fontSize={24}/></BreadcrumbButton>
                        </BreadcrumbItem>
                        <BreadcrumbDivider />
                        <BreadcrumbItem>
                            <BreadcrumbButton current>{ projectId }</BreadcrumbButton>
                        </BreadcrumbItem>
                    </Breadcrumb>
                    <ThemeSwitchButton/>
                </Stack>
                
                {
                    project ? <ProjectPageContent/> : <ProjectPageSkeleton/>
                }

            </Stack>
            {
                project === null && <ProjectNotFoundPopup open={project === null} onDismiss={() => { navigation("..") }} projectId={ projectId! } />
            }
        </ProjectProvider>
    );
}

function ProjectNotFoundPopup(props: {open: boolean, onDismiss: () => void, projectId: string}) {
    return (
        <>
            <Dialog
                // this controls the dialog open state
                open={props.open}
                onOpenChange={() => {
                    props.onDismiss();
                }}
                modalType="alert"
              >
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle> <ErrorCircleColor/> Project Not Found </DialogTitle>
                        <DialogContent>
                            No project with the name "{ props.projectId ?? "<unknown>" }" is installed.
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="primary">Back to Dashboard</Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
}