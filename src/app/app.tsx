import React from "react";
//import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MainLayout } from "app/components/layout/main-layout";



// const router = createBrowserRouter([
//     {
//         path: "/",
//         element: <Home />,
//         errorElement: <NotFound />
//     },
//     {
//         path: "/import",
//         element: <Import />
//     },
//     {
//         path: "/model",
//         element: <Model />
//     }
// ]);

function App() {
    return (
       // <RouterProvider router={router} />
        <div className="App">
            <MainLayout />
        </div>
    );
}

export default App;
