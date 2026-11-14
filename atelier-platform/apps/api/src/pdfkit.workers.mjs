import PDFDocument,{registerStdFonts} from "etalier-pdfkit-browser";
import Helvetica from "etalier-font-regular";
import HelveticaBold from "etalier-font-bold";
registerStdFonts(Helvetica,HelveticaBold);
export default PDFDocument;
