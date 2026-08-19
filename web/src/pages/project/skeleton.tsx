import { Divider, Skeleton, SkeletonItem } from "@fluentui/react-components";
import Section from "../../components/section";
import Stack from "../../components/stack";

export default function ProjectPageSkeleton() {
    return (
        <Skeleton style={{ width: "100%" }}>
            <Stack gap={24}>
                <Stack gap={24} horizontalFill>
                    <Section>
                        <Stack horizontal horizontalAlign="start" gap={8} horizontalFill>
                            <SkeletonItem size={28} shape="circle"/>
                            <SkeletonItem size={28} shape="circle"/>
                            <SkeletonItem size={32} style={{width: "250px"}}/>
                        </Stack>
                        
                        <Stack horizontal horizontalFill style={{ marginTop: 36 }}>
                            <Stack horizontal horizontalFill horizontalAlign="space-between" verticalAlign="start" gap={12} >
                                <Stack horizontal gap={12}>
                                    <SkeletonItem size={32} style={{width: "10%", minWidth: "46px"}}/>
                                    <SkeletonItem size={32} style={{width: "10%", minWidth: "46px"}}/>
                                    <SkeletonItem size={32} style={{width: "10%", minWidth: "46px"}}/>
                                </Stack>
                                <Stack horizontal>
                                    <SkeletonItem size={32} style={{width: "10%", minWidth: "46px"}}/>
                                </Stack>
                            </Stack>
                        </Stack>
                        <Divider style={{marginTop: 16, marginBottom: 12}}/>
                        <Stack gap={6} horizontalFill>
                            <SkeletonItem size={16} />
                            <SkeletonItem size={16} />
                            <SkeletonItem size={16} />
                            <SkeletonItem size={16} />
                            <SkeletonItem size={16} />
                        </Stack>
                        <Divider style={{marginTop: 16, marginBottom: 12}}/>
                    </Section>
                </Stack>
                <Stack gap={12} horizontalFill horizontalAlign="start" horizontal>
                    <SkeletonItem size={24} style={{ width: "70px" }} />
                    <SkeletonItem size={24} style={{ width: "70px" }} />
                    <SkeletonItem size={24} style={{ width: "70px" }} />
                    <SkeletonItem size={24} style={{ width: "70px" }} />
                </Stack>
                <Section>
                    <Stack horizontal gap={8} horizontalFill>
                        <SkeletonItem size={28} shape="circle"/>
                        <SkeletonItem size={32} style={{width: "250px"}}/>
                    </Stack>
                    <SkeletonItem size={56} style={{ marginTop: 12 }} />
                </Section>
            </Stack>
        </Skeleton>
    )
}