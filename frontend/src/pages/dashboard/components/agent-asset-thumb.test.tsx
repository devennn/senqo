import { render, screen } from "@testing-library/react";
import { AgentAssetThumb } from "./agent-asset-thumb";

describe("AgentAssetThumb", () => {
  // PDFs used to show the MIME prefix "application" in a dashed box; the thumb must be an icon instead.
  it("does not show the MIME type prefix for a PDF", () => {
    render(<AgentAssetThumb mimeType="application/pdf" previewUrl={null} fileName="15mb.pdf" />);
    expect(screen.queryByText("application")).not.toBeInTheDocument();
    expect(screen.getByLabelText("15mb.pdf file type")).toBeInTheDocument();
  });

  // Image assets with a preview URL should render the photo, not a type icon.
  it("shows the image preview when a preview URL exists", () => {
    const { container } = render(
      <AgentAssetThumb mimeType="image/jpeg" previewUrl="https://cdn.example/a.jpg" fileName="a.jpg" />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example/a.jpg");
  });

  // Videos are not previewed as a frame here; they get a video icon instead of the "video" MIME prefix.
  it("does not show the MIME type prefix for a video", () => {
    render(<AgentAssetThumb mimeType="video/mp4" previewUrl={null} fileName="clip.mp4" />);
    expect(screen.queryByText("video")).not.toBeInTheDocument();
    expect(screen.getByLabelText("clip.mp4 file type")).toBeInTheDocument();
  });
});
