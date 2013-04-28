// Copyright 2013 Russell Cagle

package typos.structs;

import com.sun.jna.Structure;
import java.util.Arrays;
import java.util.List;

public class Winsize extends Structure {
    public short ws_row;
    public short ws_col;
    public short ws_xpixel;
    public short ws_ypixel;

    public Winsize() {
        this.ws_row = -1;
        this.ws_col = -1;
        this.ws_xpixel = -1;
        this.ws_ypixel = -1;
    }

    public Winsize(short ws_row, short ws_col, short ws_xpixel, short ws_ypixel) {
        this.ws_row = ws_row;
        this.ws_col = ws_col;
        this.ws_xpixel = ws_xpixel;
        this.ws_ypixel = ws_ypixel;
    }

    public void setWSRow(short ws_row) {
        this.ws_row = ws_row;
    }

    public void setWSCol(short ws_col) {
        this.ws_col = ws_col;
    }

    @Override
    public List getFieldOrder() {
        return Arrays.asList("ws_row", "ws_col", "ws_xpixel", "ws_ypixel");
    }
}
