import "dotenv/config";
import app from "./app";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
    console.log(`🚀 Flash Deal API running at http://localhost:${PORT}`);
    console.log(`📄 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🩺 Health:   http://localhost:${PORT}/health`);
});
