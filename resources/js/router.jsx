import {createBrowserRouter} from "react-router-dom";
import Mainpage from "./Mainpage.jsx";

const router = createBrowserRouter([
  {
    path: '/',
    element: <Mainpage/>
  }
])

export default router;
