"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SelectDataSourceTool } from "@/components/tools/select-data-source";
import { SelectDataSourceUI } from "@/components/tools/select-data-source-ui";
import { QueryDataTool } from "@/components/tools/query-data";
import { QueryDataUI } from "@/components/tools/query-data-ui";
import { ShowSuggestionsTool } from "@/components/tools/show-suggestions";
import { StoreMemoryTool } from "@/components/tools/store-memory";
import { StoreMemoryUI } from "@/components/tools/store-memory-ui";
import { SearchMemoryTool } from "@/components/tools/search-memory";
import { SearchMemoryUI } from "@/components/tools/search-memory-ui";
import { DynamicSuggestions } from "@/components/assistant-ui/dynamic-suggestions";

export const Assistant = () => {
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SelectDataSourceTool />
      <SelectDataSourceUI />
      <QueryDataTool />
      <QueryDataUI />
      <ShowSuggestionsTool />
      <StoreMemoryTool />
      <StoreMemoryUI />
      <SearchMemoryTool />
      <SearchMemoryUI />
      <DynamicSuggestions />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Snowflake Memory Box
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    AI Data Analysis
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <Thread />
        </SidebarInset>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
